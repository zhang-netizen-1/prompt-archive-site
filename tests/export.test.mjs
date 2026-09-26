// 导出行为测试：preview 模式下案例、笔记与媒体的完整性。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportWiki } from '../scripts/lib/export.mjs';

const WIKI_ROOT = '/Users/zhiguang/wiki';
const WIKI_AVAILABLE = fs.existsSync(path.join(WIKI_ROOT, 'library/visual-prompt-system'));

async function makeTempProject() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'export-proj-'));
  fs.mkdirSync(path.join(projectRoot, 'content'), { recursive: true });
  fs.copyFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content/catalog.json'),
    path.join(projectRoot, 'content/catalog.json'),
  );
  return projectRoot;
}

test('preview 导出：案例、笔记、媒体与报告齐备', { skip: WIKI_AVAILABLE ? false : '本机无 Wiki 源' }, async () => {
  const projectRoot = await makeTempProject();
  const report = await exportWiki({ wikiRoot: WIKI_ROOT, projectRoot, mode: 'preview' });

  const expectedCases = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content/catalog.json'), 'utf8')).cases.length;
  const data = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/generated/cases.json'), 'utf8'));
  assert.equal(data.mode, 'preview');
  assert.equal(data.cases.length, expectedCases, '清单内全部案例导出');

  const mediaDir = path.join(projectRoot, 'public/media');
  let mediaCount = 0;
  for (const c of data.cases) {
    assert.ok(c.promptBlocks.length >= 1, `${c.slug} 至少一个提示词块`);
    for (const b of c.promptBlocks) {
      assert.ok(b.raw.trim().length > 0, `${c.slug} 提示词块非空`);
      assert.ok(!b.raw.includes('/Users/zhiguang'), '提示词原文不含本机绝对路径');
    }
    if (c.promptBlocks.length === 1) {
      assert.equal(c.fullPrompt, c.promptBlocks[0].raw, '单块案例 fullPrompt 与块原文一致');
    } else {
      assert.equal(c.fullPrompt, null, '多段案例不提供全文复制，避免拼接非原文');
    }
    for (const m of c.media) {
      mediaCount += 1;
      const file = path.join(mediaDir, path.basename(m.url));
      assert.ok(fs.existsSync(file), `媒体已复制：${m.url}`);
      assert.ok(fs.statSync(file).size > 0);
      assert.ok(!m.url.includes('/Users/'), '媒体地址不含本机路径');
    }
    if (c.medium === 'video' && c.evidence === 'film-attached') {
      const film = c.media.find((m) => m.role === 'result' && m.kind === 'video');
      assert.ok(film, `${c.slug} 声明有成片则必须有结果媒体`);
      assert.ok(film.poster, '成片应有海报帧');
    }
  }
  assert.ok(mediaCount <= report.counts.media, '案例声明的媒体都计入导出媒体总量');

  // 原文逐字抽查：圣诞案例
  const christmas = data.cases.find((c) => c.slug === 'christmas-snow-chase');
  assert.ok(christmas.fullPrompt.startsWith('【全局设定】'));
  assert.ok(christmas.fullPrompt.trimEnd().endsWith('环境音：落地闷响、鹿铃远去、轻快圣诞音乐渐起。'));
  assert.ok(christmas.fullPrompt.includes('Shot 05（11.5–15秒）'), '提示词保留原文镜头标记');

  // 多段案例
  const sunsets = data.cases.find((c) => c.slug === 'forty-three-sunsets');
  assert.equal(sunsets.promptBlocks.length, 6);
  assert.ok(sunsets.promptBlocks[0].label.includes('①'));
  assert.equal(sunsets.media.length, 7);
  assert.equal(sunsets.evidence, 'author-tested');

  // 笔记生成
  const expectedNotes = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content/catalog.json'), 'utf8')).notes.length;
  const notesData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/generated/notes.json'), 'utf8'));
  assert.equal(notesData.notes.length, expectedNotes);
  for (const n of notesData.notes) {
    const mdPath = path.join(projectRoot, 'src/generated/notes', `${n.slug}.md`);
    assert.ok(fs.existsSync(mdPath), `笔记文件存在：${n.slug}`);
    const md = fs.readFileSync(mdPath, 'utf8');
    assert.ok(md.startsWith('---\n'), '笔记带 frontmatter');
    assert.ok(!/\[\[[^\]]+\]\]/.test(md), `${n.slug} 不应残留 Obsidian 链接（围栏外）`);
    assert.ok(n.toc.length >= 0);
  }
  // 内链已转成站内地址：视频提示词总结构应链接到案例页与笔记页
  const structureMd = fs.readFileSync(path.join(projectRoot, 'src/generated/notes/video-prompt-structure.md'), 'utf8');
  assert.ok(structureMd.includes('](/cases/christmas-snow-chase/)'), '笔记内链转换为案例地址');
  assert.ok(structureMd.includes('](/notes/'), '笔记内链转换为笔记地址');

  // 未解析链接已记录且渲染为纯文本（不产生死链）
  assert.ok(report.unresolvedLinks.length >= 1, '未解析内链已记录并保留为纯文本');
  assert.equal(report.errors.length, 0, 'preview 导出零错误');
  const varsMd = fs.readFileSync(path.join(projectRoot, 'src/generated/notes/character-style-variables.md'), 'utf8');
  assert.ok(!varsMd.includes('](/notes/👀图片-'), '未收录目标不生成站内链接');
});

test('证据状态与展示文案的映射正确', { skip: WIKI_AVAILABLE ? false : '本机无 Wiki 源' }, async () => {
  const projectRoot = await makeTempProject();
  await exportWiki({ wikiRoot: WIKI_ROOT, projectRoot, mode: 'preview' });
  const data = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/generated/cases.json'), 'utf8'));
  const withFilm = data.cases.filter((c) => c.evidence === 'film-attached');
  assert.equal(withFilm.length, 2, '有实测成片的案例');
  const authorTested = data.cases.filter((c) => c.evidence === 'author-tested');
  const examples = data.cases.filter((c) => c.evidence === 'source-example');
  assert.equal(authorTested.length + withFilm.length + examples.length, data.cases.length,
    '证据状态互斥且完备');
  for (const c of authorTested) {
    assert.ok(!c.media.some((m) => m.role === 'result'), '作者称已测试的案例不得带结果媒体');
  }
  for (const c of examples) {
    assert.ok(c.media.every((m) => m.role !== 'result'), '示例类案例不得声明生成结果媒体');
  }
});

test('构建失败路径：缺失源文件与重复 slug 必须报错', async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'export-bad-'));
  fs.mkdirSync(path.join(projectRoot, 'content'), { recursive: true });
  const badCatalog = {
    version: '0',
    cases: [
      {
        slug: 'dup', title: '重复一', source: 'library/none1.md', promptBlocks: [{ heading: 'x' }],
        medium: 'video', topic: 't', evidence: 'author-tested', approvedForPublic: true,
      },
      {
        slug: 'dup', title: '重复二', source: 'library/none2.md', promptBlocks: [{ heading: 'x' }],
        medium: 'video', topic: 't', evidence: 'author-tested', approvedForPublic: true,
      },
      {
        slug: 'bad-medium', title: '坏枚举', source: 'library/none3.md', promptBlocks: [{ heading: 'x' }],
        medium: 'audio', topic: 't', evidence: 'author-tested', approvedForPublic: true,
      },
    ],
    notes: [],
    collections: [],
  };
  fs.writeFileSync(path.join(projectRoot, 'content/catalog.json'), JSON.stringify(badCatalog));
  const report = await exportWiki({ wikiRoot: WIKI_ROOT, projectRoot, mode: 'preview' });
  const types = report.errors.map((e) => e.type);
  assert.ok(types.includes('duplicate-slug'), '重复 slug 报错');
  assert.ok(types.includes('invalid-enum'), '非法 medium 报错');
  assert.ok(types.includes('missing-source'), '缺失源文件报错');
});
