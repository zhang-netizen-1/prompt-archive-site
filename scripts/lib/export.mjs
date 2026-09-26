// 依据 content/catalog.json 从 Wiki 只读导出案例、笔记与获准媒体。
// 生成 src/generated/*（结构化数据与转换后的笔记）与 public/media/*（媒体副本）。
// SITE_MODE=public 时仅导出 approvedForPublic: true 的条目。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import GithubSlugger from 'github-slugger';
import { readSource, findFencedBlock } from './source.mjs';
import {
  buildWikiIndex,
  resolveObsidianMedia,
  resolveRelativeMediaInWiki,
  parseWikiLink,
  resolveDocLink,
} from './wiki-links.mjs';

const execFileAsync = promisify(execFile);

const MEDIA_URL_BASE = '/media';
const VALID_MEDIUMS = new Set(['image', 'video', 'mixed']);
const CASE_MEDIUMS = new Set(['image', 'video']);
const VALID_EVIDENCE = new Set([
  'film-attached', 'author-tested', 'no-record',
  'result-attached', 'source-example', 'reference-only',
]);
const VALID_MEDIA_ROLES = new Set(['result', 'reference', 'example']);
const VALID_MEDIA_KINDS = new Set(['image', 'video']);

/** 复制一个媒体文件到 public/media，文件名 = 内容哈希 + 扩展名。 */
function copyMedia(absPath, mediaDir, copied) {
  const buf = fs.readFileSync(absPath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  const ext = path.extname(absPath).toLowerCase() || '.bin';
  const name = `${hash}${ext}`;
  if (!copied.has(name)) {
    fs.writeFileSync(path.join(mediaDir, name), buf);
    copied.set(name, { absPath, bytes: buf.length });
  }
  return `${MEDIA_URL_BASE}/${name}`;
}

/** 为视频生成海报帧（macOS qlmanage，尽力而为；失败不阻断导出）。 */
async function makeVideoPoster(absPath, mediaDir, hashName) {
  const posterName = `${path.basename(hashName, path.extname(hashName))}-poster.png`;
  const posterPath = path.join(mediaDir, posterName);
  if (fs.existsSync(posterPath)) return `${MEDIA_URL_BASE}/${posterName}`;
  try {
    const tmp = fs.mkdtempSync(path.join(path.dirname(mediaDir), '.poster-'));
    await execFileAsync('qlmanage', ['-t', '-s', '1280', '-o', tmp, absPath], { timeout: 30000 });
    const produced = fs.readdirSync(tmp).find((f) => f.endsWith('.png'));
    if (produced) {
      fs.copyFileSync(path.join(tmp, produced), posterPath);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    return fs.existsSync(posterPath) ? `${MEDIA_URL_BASE}/${posterName}` : null;
  } catch {
    return null;
  }
}

/** 案例：抽取提示词原文块，解析媒体。 */
async function exportCase(entry, ctx) {
  const { wikiRoot, index, mediaDir, copied, report, mode } = ctx;
  const absSource = path.join(wikiRoot, entry.source);
  if (!fs.existsSync(absSource)) {
    report.errors.push({ type: 'missing-source', message: `源文件不存在：${entry.source}`, entry: entry.slug });
    return null;
  }
  const source = readSource(absSource);

  const promptBlocks = [];
  for (const spec of entry.promptBlocks ?? []) {
    try {
      const block = findFencedBlock(source, { heading: spec.heading, section: spec.section });
      promptBlocks.push({ label: spec.label, heading: spec.heading, section: spec.section ?? null, raw: block.raw, sourceLines: [block.startLine, block.endLine] });
    } catch (err) {
      report.errors.push({ type: 'prompt-block', message: err.message, entry: entry.slug });
    }
  }
  if (promptBlocks.length === 0) return null;

  const media = [];
  for (const m of entry.media ?? []) {
    if (!VALID_MEDIA_ROLES.has(m.role) || !VALID_MEDIA_KINDS.has(m.kind)) {
      report.errors.push({ type: 'invalid-enum', message: `非法媒体 role/kind：${m.role}/${m.kind}`, entry: entry.slug });
      continue;
    }
    const absMedia = path.join(wikiRoot, m.ref);
    let resolution = { status: 'missing' };
    if (fs.existsSync(absMedia)) {
      resolution = { status: 'ok', absPath: absMedia, matchedBy: 'wiki-root-path' };
    } else {
      resolution = resolveObsidianMedia(index, m.ref);
    }
    if (resolution.status !== 'ok') {
      report.errors.push({
        type: resolution.status === 'ambiguous' ? 'ambiguous-media' : 'missing-media',
        message: `案例媒体无法解析（${resolution.status}）：${m.ref}`,
        entry: entry.slug,
      });
      continue;
    }
    const url = copyMedia(resolution.absPath, mediaDir, copied);
    const item = { role: m.role, kind: m.kind, label: m.label, url };
    if (m.kind === 'video') {
      item.poster = await makeVideoPoster(resolution.absPath, mediaDir, url);
    }
    media.push(item);
  }

  const fullPrompt = promptBlocks.length === 1 ? promptBlocks[0].raw : null;
  const searchText = [
    entry.title, entry.topic, entry.summary ?? '',
    (entry.tags ?? []).join(' '),
    promptBlocks.map((b) => b.raw).join('\n'),
  ].join('\n').toLowerCase();

  return {
    slug: entry.slug,
    title: entry.title,
    sourceDisplay: entry.sourceDisplay ?? entry.source,
    medium: entry.medium,
    topic: entry.topic,
    tags: entry.tags ?? [],
    evidence: entry.evidence,
    duration: entry.duration ?? null,
    summary: entry.summary ?? '',
    media,
    provenance: entry.provenance ?? {},
    relatedNotes: entry.relatedNotes ?? [],
    collection: entry.collection ?? null,
    chain: entry.chain ?? [],
    featured: entry.featured ?? false,
    approvedForPublic: entry.approvedForPublic === true,
    promptBlocks,
    fullPrompt,
    searchText,
  };
}

/** 逐行转换笔记正文：跳过围栏，重写 Obsidian 链接与媒体引用。 */
function convertNoteMarkdown(body, noteAbs, ctx, linkMap, anchorIndex) {
  const { index, mediaDir, copied, report } = ctx;
  const slug = ctx.slug;
  const lines = body.split('\n');
  const out = [];
  const unresolved = [];
  let inFence = false;
  let fenceMarker = null;

  const wikiLinkRe = /(!?)\[\[([^\]]+)\]\]/g;
  const mdImageRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const mdLinkRe = /(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const line of lines) {
    let working = line;
    const fenceMatch = working.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fenceMatch[1][0];
      } else if (fenceMatch[1][0] === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      out.push(working);
      continue;
    }
    if (inFence) {
      out.push(working);
      continue;
    }

    // Obsidian 嵌入与链接
    working = working.replace(wikiLinkRe, (whole, embed, inner) => {
      const { target, anchor, alias } = parseWikiLink(inner);
      const text = alias || (anchor ? `${target} › ${anchor}` : target);
      if (embed === '!') {
        const resolution = resolveObsidianMedia(index, target);
        if (resolution.status === 'ok') {
          const url = copyMedia(resolution.absPath, mediaDir, copied);
          return `![${text}](${url})`;
        }
        report.errors.push({ type: 'missing-media', message: `笔记媒体无法解析（${resolution.status}）：${target}`, entry: slug });
        return `[缺失媒体：${text}]`;
      }
      if (!target) {
        // 同页锚点 [[#标题|别名]]
        const key = anchor;
        const heads = anchorIndex.get(slug) ?? [];
        const hit = heads.find((h) => h.text === anchor);
        if (hit) return `[${text || anchor}](#${hit.slug})`;
        unresolved.push({ target: `#${anchor}`, rendered: 'plain-text' });
        return text || anchor;
      }
      const resolved = resolveDocLink(linkMap, target, anchor);
      if (resolved.status === 'ok') {
        let url = resolved.url;
        if (resolved.anchor) {
          const heads = anchorIndex.get(path.basename(resolved.url.replace(/\/$/, ''))) ?? [];
          const hit = heads.find((h) => h.text === resolved.anchor);
          url = hit ? `${url}#${hit.slug}` : url;
          if (!hit) unresolved.push({ target: `${target}#${anchor}`, rendered: 'link-without-anchor' });
        }
        return `[${text}](${url})`;
      }
      unresolved.push({ target, rendered: 'plain-text' });
      return text;
    });

    // Markdown 相对图片
    working = working.replace(mdImageRe, (whole, alt, ref) => {
      if (/^(https?:)?\/\//i.test(ref) || ref.startsWith('/') || ref.startsWith('/media/')) return whole;
      const resolution = resolveRelativeMediaInWiki(index, noteAbs, ref);
      if (resolution.status === 'ok') {
        const url = copyMedia(resolution.absPath, mediaDir, copied);
        return `![${alt}](${url})`;
      }
      if (resolution.status === 'external') return whole;
      report.errors.push({ type: 'missing-media', message: `笔记相对路径图片无法解析（${resolution.status}）：${ref}`, entry: slug });
      return `[缺失媒体：${alt || ref}]`;
    });

    // Markdown 相对链接（指向 Wiki 内文件时改写或转纯文本）
    working = working.replace(mdLinkRe, (whole, text, ref) => {
      if (/^(https?:)?\/\//i.test(ref) || ref.startsWith('/') || ref.startsWith('#') || ref.startsWith('mailto:')) return whole;
      if (ref.endsWith('.md')) {
        const resolved = resolveDocLink(linkMap, ref, '');
        if (resolved.status === 'ok') return `[${text}](${resolved.url})`;
        unresolved.push({ target: ref, rendered: 'plain-text' });
        return text;
      }
      return whole;
    });

    out.push(working);
  }

  return { markdown: out.join('\n'), unresolved };
}

/**
 * 笔记中的取值表格规范化 + 取值速拷代码块。
 * 背景：Wiki 源里存在两种非标准表格（分隔行在最前 / 完全没有分隔行），
 * 标准 Markdown 解析器不渲染为表格，取值散落成管道文本。
 * 此处只做结构性修正（行序调整、补分隔行），取值文本逐字保留；
 * 含「提示词」取值列的表格在表后追加密拷代码块（逐字一致）。
 */
const PIPE_GROUP_MIN = 2;

function splitPipeRow(line) {
  const cells = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
  return cells.map((c) => c.trim());
}

function isPipeLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

export function normalizeValueTables(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let inFence = false;
  let fenceMarker = null;
  let copyBlocks = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const fm = line.match(/^\s*(`{3,}|~{3,})/);
    if (fm) {
      if (!inFence) { inFence = true; fenceMarker = fm[1][0]; }
      else if (fm[1][0] === fenceMarker) { inFence = false; fenceMarker = null; }
      out.push(line);
      i += 1;
      continue;
    }
    if (inFence) { out.push(line); i += 1; continue; }

    if (!isPipeLine(line)) { out.push(line); i += 1; continue; }

    // 收集连续管道行组成表格组
    const start = i;
    const group = [];
    while (i < lines.length && isPipeLine(lines[i])) {
      group.push(lines[i]);
      i += 1;
    }
    if (group.length < PIPE_GROUP_MIN) { out.push(...group); continue; }

    const rows = group.map(splitPipeRow);
    const isDelim = (cells) => cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c.replace(/\s/g, '')) );

    // 判定表头与分隔行位置
    let headerIdx = -1;
    let delimAt = -1; // group 内分隔行下标
    if (group.length >= 2 && isDelim(rows[1])) {
      headerIdx = 0; delimAt = 1;               // 标准形式：表头在首
    } else if (isDelim(rows[0])) {
      headerIdx = 1; delimAt = 0;               // Obsidian 形式：分隔行在最前
    }

    // 无分隔行：若表格紧跟「变量库·节选」且为两列（标签|取值），则整组都是数据行、无表头
    let noHeaderMode = false;
    let valueCol = -1;

    // 规则 1：表头单元格含「提示词」→ 该列
    const probeHeader = headerIdx >= 0 ? rows[headerIdx] : rows[0];
    valueCol = probeHeader.findIndex((c) => c.replace(/[*\s]/g, '').includes('提示词'));

    // 规则 2：表格紧跟「变量库·节选」说明行 → 末列视为取值列
    if (valueCol === -1) {
      let prev = start - 1;
      while (prev >= 0 && lines[prev].trim() === '') prev -= 1;
      if (prev >= 0 && /变量库·节选|取值包/.test(lines[prev])) {
        valueCol = rows[0].length - 1;
        if (delimAt === -1 && rows[0].length === 2) noHeaderMode = true;
      }
    }

    // 无分隔行的常规表：首行即表头（取值从第二行开始）
    if (!noHeaderMode && headerIdx === -1) headerIdx = 0;

    // 重排/补分隔行，输出规范化表格
    if (headerIdx === 1 && delimAt === 0) {
      out.push(group[1]);   // 表头
      out.push(group[0]);   // 分隔行
      for (let k = 2; k < group.length; k += 1) out.push(group[k]);
    } else if (delimAt === -1 && noHeaderMode) {
      // 两列全取值表：补表头与分隔行，全部行保留为数据
      out.push('| 取值 | 提示词 |');
      out.push('|---|---|');
      out.push(...group);
    } else if (delimAt === -1) {
      // 无分隔行：首行为表头，补一条分隔行
      out.push(group[0]);
      out.push('|' + rows[0].map(() => '---').join('|') + '|');
      for (let k = 1; k < group.length; k += 1) out.push(group[k]);
    } else {
      out.push(...group);
    }

    // 追加取值速拷代码块
    if (valueCol >= 0) {
      const values = [];
      const bodyStart = noHeaderMode ? 0 : headerIdx + 1;
      for (let k = bodyStart; k < rows.length; k += 1) {
        if (k === delimAt) continue;
        if (isDelim(rows[k])) continue;
        const v = rows[k][valueCol];
        if (v && v.trim()) values.push(v.trim());
      }
      if (values.length > 0) {
        copyBlocks += 1;
        out.push('');
        out.push(`**取值速拷（${values.length} 条 · 与上表逐字一致）**`);
        out.push('');
        out.push('```text');
        out.push(...values);
        out.push('```');
      }
    }
  }
  return { markdown: out.join('\n'), copyBlocks };
}

/**
 * @param {{ wikiRoot: string, projectRoot: string, mode: 'preview'|'public' }} options
 */
export async function exportWiki(options) {
  const { wikiRoot, projectRoot, mode } = options;
  const catalogPath = path.join(projectRoot, 'content/catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  const generatedDir = path.join(projectRoot, 'src/generated');
  const generatedNotesDir = path.join(generatedDir, 'notes');
  const mediaDir = path.join(projectRoot, 'public/media');
  for (const dir of [generatedDir, generatedNotesDir, mediaDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }

  let valueCopyBlocksTotal = 0;
  const report = {
    mode,
    generatedAt: new Date().toISOString(),
    wikiRoot,
    counts: { cases: 0, notes: 0, media: 0, collections: 0 },
    errors: [],
    warnings: [],
    unresolvedLinks: [],
    excludedFromPublic: [],
  };

  const index = buildWikiIndex(wikiRoot);
  const copied = new Map();
  const anchorIndex = new Map();

  // 链接表：笔记/案例/合集的标题、slug 与源文件名（不含 .md）都可作为链接目标。
  // Wiki 内链通常引用源文件名（如 [[模板-视频提示词总结构]]），而非站点标题。
  const linkMap = new Map();
  const addLink = (key, url, kind) => {
    if (key && !linkMap.has(key)) linkMap.set(key, { url, kind });
  };
  for (const n of catalog.notes ?? []) {
    const url = `/notes/${n.slug}/`;
    addLink(n.title, url, 'note');
    addLink(n.slug, url, 'note');
    addLink(path.basename(n.source).replace(/\.md$/i, ''), url, 'note');
  }
  for (const c of catalog.cases ?? []) {
    const url = `/cases/${c.slug}/`;
    addLink(c.title, url, 'case');
    addLink(c.slug, url, 'case');
    addLink(path.basename(c.source).replace(/\.md$/i, ''), url, 'case');
  }
  for (const col of catalog.collections ?? []) {
    const url = `/collections/${col.slug}/`;
    addLink(col.title, url, 'collection');
    addLink(col.slug, url, 'collection');
  }

  // 校验 slug 唯一与枚举合法（不区分模式，清单本身必须干净）
  const seenSlugs = new Set();
  for (const c of catalog.cases ?? []) {
    if (seenSlugs.has(c.slug)) report.errors.push({ type: 'duplicate-slug', message: `重复案例 slug：${c.slug}`, entry: c.slug });
    seenSlugs.add(c.slug);
    if (!CASE_MEDIUMS.has(c.medium)) report.errors.push({ type: 'invalid-enum', message: `非法案例 medium：${c.medium}`, entry: c.slug });
    if (!VALID_EVIDENCE.has(c.evidence)) report.errors.push({ type: 'invalid-enum', message: `非法案例 evidence：${c.evidence}`, entry: c.slug });
  }
  for (const n of catalog.notes ?? []) {
    if (seenSlugs.has(n.slug)) report.errors.push({ type: 'duplicate-slug', message: `重复笔记 slug：${n.slug}`, entry: n.slug });
    seenSlugs.add(n.slug);
    if (!VALID_MEDIUMS.has(n.medium ?? 'mixed')) report.errors.push({ type: 'invalid-enum', message: `非法笔记 medium：${n.medium}`, entry: n.slug });
  }
  const catalogCaseSlugs = new Set((catalog.cases ?? []).map((c) => c.slug));
  for (const col of catalog.collections ?? []) {
    for (const s of col.caseSlugs ?? []) {
      if (!catalogCaseSlugs.has(s)) report.errors.push({ type: 'broken-reference', message: `合集 ${col.slug} 引用了不存在的案例：${s}`, entry: col.slug });
    }
  }

  // 导出案例。档案编号按清单顺序分配（PA-001…），稳定 slug 保证页面地址不变；
  // 如需重排条目，编号随之变化，应视同内容变更对待。
  const cases = [];
  let caseSeq = 0;
  for (const entry of catalog.cases ?? []) {
    if (mode === 'public' && entry.approvedForPublic !== true) {
      report.excludedFromPublic.push({ slug: entry.slug, kind: 'case', reason: '未通过公开审核' });
      continue;
    }
    caseSeq += 1;
    const exported = await exportCase(entry, { wikiRoot, index, mediaDir, copied, report, mode });
    if (exported) {
      exported.archiveNo = `PA-${String(caseSeq).padStart(3, '0')}`;
      cases.push(exported);
    }
  }

  // 笔记导出分两步：先为全部笔记建立标题锚点索引，再逐篇转换正文，
  // 使跨笔记的「[[目标#标题]]」锚点在任何转换顺序下都能解析。
  const noteEntries = (catalog.notes ?? []).filter(
    (n) => !(mode === 'public' && n.approvedForPublic !== true),
  );
  for (const n of (catalog.notes ?? [])) {
    if (mode === 'public' && n.approvedForPublic !== true) {
      report.excludedFromPublic.push({ slug: n.slug, kind: 'note', reason: '未通过公开审核' });
    }
  }

  async function buildNoteToc(entry) {
    const absSource = path.join(wikiRoot, entry.source);
    if (!fs.existsSync(absSource)) {
      report.errors.push({ type: 'missing-source', message: `笔记源文件不存在：${entry.source}`, entry: entry.slug });
      return null;
    }
    const source = readSource(absSource);
    const slugger = new GithubSlugger();
    const toc = [];
    // 与 rehype-slug 一致：所有标题按文档顺序喂给 slugger，目录只记录 2–3 级
    for (const h of source.headings) {
      const s = slugger.slug(h.text);
      if (h.level >= 2 && h.level <= 3) toc.push({ depth: h.level, text: h.text, slug: s });
    }
    anchorIndex.set(entry.slug, toc);
    anchorIndex.set(entry.title, toc);
    return { absSource, source, toc };
  }

  const precomputed = new Map();
  for (const entry of noteEntries) {
    const pre = await buildNoteToc(entry);
    if (pre) precomputed.set(entry.slug, pre);
  }

  // 站点页面已渲染标题，正文首个与标题重复的 H1 不再输出，避免同屏出现两次。
  function stripDuplicateH1(body, title) {
    const lines = body.split('\n');
    const idx = lines.findIndex((l) => /^#\s+(.*?)\s*#*\s*$/.test(l));
    if (idx === -1) return body;
    const m = lines[idx].match(/^#\s+(.*?)\s*#*\s*$/);
    if (m[1].replace(/\s+/g, '') === title.replace(/\s+/g, '')) {
      lines.splice(idx, 1);
      return lines.join('\n');
    }
    return body;
  }

  const notes = [];
  for (const entry of noteEntries) {
    const pre = precomputed.get(entry.slug);
    if (!pre) continue;
    const converted0 = convertNoteMarkdown(stripDuplicateH1(pre.source.body, entry.title), pre.absSource, { wikiRoot, index, mediaDir, copied, report, mode, slug: entry.slug }, linkMap, anchorIndex);
    const norm = normalizeValueTables(converted0.markdown);
    const converted = { markdown: norm.markdown, unresolved: converted0.unresolved };
    valueCopyBlocksTotal += norm.copyBlocks;
    for (const u of converted.unresolved) {
      report.unresolvedLinks.push({ entry: entry.slug, target: u.target, renderedAs: u.rendered });
      report.warnings.push({ type: 'unresolved-link', message: `未解析内链（已保留为纯文本）：${u.target}`, entry: entry.slug });
    }

    const fm = [
      '---',
      `slug: ${entry.slug}`,
      `title: ${JSON.stringify(entry.title)}`,
      `summary: ${JSON.stringify(entry.summary ?? '')}`,
      `category: ${entry.category ?? '笔记'}`,
      `medium: ${entry.medium ?? 'mixed'}`,
      `sourceDisplay: ${JSON.stringify(entry.sourceDisplay ?? entry.source)}`,
      '---',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(generatedNotesDir, `${entry.slug}.md`), fm + converted.markdown);

    notes.push({
      slug: entry.slug,
      title: entry.title,
      summary: entry.summary ?? '',
      category: entry.category ?? '笔记',
      medium: entry.medium ?? 'mixed',
      sourceDisplay: entry.sourceDisplay
        ?? `${path.basename(entry.source).replace(/\.md$/i, '')}（${path.basename(path.dirname(entry.source))}）`,
      approvedForPublic: entry.approvedForPublic === true,
      toc: pre.toc,
      searchText: [entry.title, entry.summary ?? '', entry.category ?? '', pre.source.body].join('\n').toLowerCase(),
    });
  }

  // 反向关联：笔记 → 引用它的案例
  for (const note of notes) {
    note.relatedCases = cases.filter((c) => c.relatedNotes.includes(note.slug)).map((c) => c.slug);
  }

  // 合集
  const collections = [];
  for (const col of catalog.collections ?? []) {
    if (mode === 'public' && col.approvedForPublic !== true) {
      report.excludedFromPublic.push({ slug: col.slug, kind: 'collection', reason: '未通过公开审核' });
      continue;
    }
    const members = (col.caseSlugs ?? []).filter((s) => cases.some((c) => c.slug === s));
    collections.push({
      slug: col.slug,
      title: col.title,
      description: col.description ?? '',
      sourceDisplay: col.sourceDisplay ?? '',
      caseSlugs: members,
      approvedForPublic: col.approvedForPublic === true,
    });
  }

  report.counts = { cases: cases.length, notes: notes.length, media: copied.size, collections: collections.length, valueCopyBlocks: valueCopyBlocksTotal };

  // 生成结构化数据
  fs.writeFileSync(path.join(generatedDir, 'cases.json'), JSON.stringify({ mode, cases }, null, 2));
  fs.writeFileSync(path.join(generatedDir, 'notes.json'), JSON.stringify({ mode, notes }, null, 2));
  fs.writeFileSync(path.join(generatedDir, 'collections.json'), JSON.stringify({ mode, collections }, null, 2));
  fs.writeFileSync(path.join(generatedDir, 'report.json'), JSON.stringify(report, null, 2));

  return report;
}
