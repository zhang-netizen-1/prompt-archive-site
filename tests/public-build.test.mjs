// 公开门禁测试：SITE_MODE=public 时只导出获准条目，构建数据零错误。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportWiki } from '../scripts/lib/export.mjs';

const WIKI_ROOT = '/Users/zhiguang/wiki';
const WIKI_AVAILABLE = fs.existsSync(path.join(WIKI_ROOT, 'library/visual-prompt-system'));

test('公开门禁：public 导出仅含 approvedForPublic 条目且可复核', { skip: WIKI_AVAILABLE ? false : '本机无 Wiki 源' }, async () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'public-build-'));
  fs.mkdirSync(path.join(projectRoot, 'content'), { recursive: true });
  fs.copyFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content/catalog.json'),
    path.join(projectRoot, 'content/catalog.json'),
  );
  const report = await exportWiki({ wikiRoot: WIKI_ROOT, projectRoot, mode: 'public' });

  const cases = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/generated/cases.json'), 'utf8')).cases;
  const notes = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/generated/notes.json'), 'utf8')).notes;
  const collections = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/generated/collections.json'), 'utf8')).collections;

  assert.ok(cases.every((item) => item.approvedForPublic === true), '公开案例全部已获准');
  assert.equal(new Set(cases.map((item) => item.slug)).size, cases.length, '无重复 slug');
  assert.ok(notes.every((item) => item.approvedForPublic === true), '公开笔记全部已获准');
  assert.ok(collections.every((item) => item.approvedForPublic === true), '公开合集全部已获准');
  assert.equal(report.errors.length, 0, '公开导出零错误');
  // 用户已决定全部公开：排除列表允许为空；若未来再有暂不公开条目，必须完整记录
  for (const e of report.excludedFromPublic) {
    assert.ok(e.reason, '每项排除必须带理由');
  }

  // 公开数据中不残留未审核条目的痕迹：搜索文本、合集成员、笔记关联案例
  const approvedCaseSlugs = new Set(cases.map((c) => c.slug));
  for (const col of collections) {
    assert.ok(col.caseSlugs.every((s) => approvedCaseSlugs.has(s)), '合集成员全部为公开案例');
  }
  const approvedNoteSlugs = new Set(notes.map((n) => n.slug));
  for (const c of cases) {
    assert.ok(
      c.relatedNotes.every((s) => approvedNoteSlugs.has(s)),
      `${c.slug} 的关联笔记全部为公开笔记`,
    );
  }
});
