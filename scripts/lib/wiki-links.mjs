// 解析 Obsidian 文档链接与媒体引用（只读 Wiki）。
// 解析顺序：文档链接按站点链接表匹配；Obsidian 媒体先按 Wiki 根相对路径，
// 再按全库唯一文件名匹配；Markdown 相对路径先按源文件目录解析。
// 任何引用都不允许把本机绝对路径写进站点输出。
import fs from 'node:fs';
import path from 'node:path';

const MEDIA_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif',
  '.mp4', '.webm', '.mov', '.m4v', '.ogv',
  '.mp3', '.wav', '.m4a', '.ogg',
]);

/** 递归索引 Wiki 内全部文件：根相对路径 → 绝对路径；文件名 → 命中列表。 */
export function buildWikiIndex(wikiRoot) {
  const files = new Map(); // normalized root-relative posix path -> abs
  const byName = new Map(); // basename -> abs[]

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.obsidian' || entry.name === '.git' || entry.name === '.trash') continue;
        walk(abs);
      } else if (entry.isFile()) {
        const rel = path.relative(wikiRoot, abs).split(path.sep).join('/');
        files.set(rel, abs);
        const name = path.basename(abs);
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push(abs);
      }
    }
  }

  walk(wikiRoot);
  return { wikiRoot, files, byName };
}

/** 解析 Obsidian 媒体引用：先按根相对路径，再按全库唯一文件名。 */
export function resolveObsidianMedia(index, ref) {
  const cleaned = decodeURIComponent(ref.trim());
  const direct = index.files.get(cleaned);
  if (direct) return { status: 'ok', absPath: direct, matchedBy: 'wiki-root-path' };

  const base = path.basename(cleaned);
  const hits = index.byName.get(base) ?? [];
  if (hits.length === 1) return { status: 'ok', absPath: hits[0], matchedBy: 'unique-filename' };
  if (hits.length > 1) return { status: 'ambiguous', absPath: null, candidates: hits };
  return { status: 'missing', absPath: null };
}

// Markdown 相对路径图片：先按源文件目录，再按全库唯一文件名。
/**
 * @param {{ wikiRoot: string, files: Map<string,string>, byName: Map<string,string[]> }} index
 */
export function resolveRelativeMediaInWiki(index, sourceAbsPath, ref) {
  const cleaned = decodeURIComponent(ref.trim());
  if (/^(https?:)?\/\//i.test(cleaned) || cleaned.startsWith('data:')) {
    return { status: 'external', absPath: null };
  }
  const joined = path.resolve(path.dirname(sourceAbsPath), cleaned);
  const rel = path.relative(index.wikiRoot, joined);
  if (!rel.startsWith('..') && index.files.has(rel.split(path.sep).join('/'))) {
    return { status: 'ok', absPath: joined, matchedBy: 'source-relative' };
  }
  const base = path.basename(cleaned);
  const hits = index.byName.get(base) ?? [];
  if (hits.length === 1) return { status: 'ok', absPath: hits[0], matchedBy: 'unique-filename' };
  if (hits.length > 1) return { status: 'ambiguous', absPath: null, candidates: hits };
  return { status: 'missing', absPath: null };
}

export function isMediaFile(name) {
  return MEDIA_EXTENSIONS.has(path.extname(name).toLowerCase());
}

/**
 * 解析 Obsidian 文档链接内部结构。
 * 支持：[[目标]]、[[目标#标题]]、[[目标#标题|别名]]、[[|别名]]（同页锚点）。
 */
export function parseWikiLink(inner) {
  const [beforeAlias, alias] = inner.split('|');
  const [targetPart, ...anchorParts] = beforeAlias.split('#');
  return {
    target: targetPart.trim(),
    anchor: anchorParts.join('#').trim(),
    alias: (alias ?? '').trim(),
  };
}

/**
 * 在站点链接表中解析文档链接。
 * linkMap: Map<规范化标题, { url, kind: 'note'|'case'|'collection' }>
 * 命中返回 { status:'ok', url, anchor, kind }；未命中返回 { status:'unresolved' }。
 */
export function resolveDocLink(linkMap, target, anchor) {
  const key = target.replace(/\.md$/i, '').trim();
  const direct = linkMap.get(key);
  if (direct) return { status: 'ok', url: direct.url, anchor, kind: direct.kind };
  // 目标可能带路径前缀（如 library/...），退回按文件名匹配
  const baseKey = path.basename(key);
  if (baseKey !== key) {
    const hit = linkMap.get(baseKey);
    if (hit) return { status: 'ok', url: hit.url, anchor, kind: hit.kind };
  }
  return { status: 'unresolved', url: null, anchor };
}

/** 提取标题的 slug，与 rehype-slug（github-slugger）保持一致。 */
export function headingSlug(text, slugger) {
  return slugger.slug(text);
}
