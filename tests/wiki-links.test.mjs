// Wiki 链接与媒体解析测试：在临时目录构造假 Wiki 树，覆盖四类引用。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildWikiIndex,
  resolveObsidianMedia,
  resolveRelativeMediaInWiki,
  parseWikiLink,
  resolveDocLink,
} from '../scripts/lib/wiki-links.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-links-'));
fs.mkdirSync(path.join(root, 'raw/assets/visual-prompt-system/圣诞夜雪街追逐'), { recursive: true });
fs.mkdirSync(path.join(root, 'library/visual-prompt-system'), { recursive: true });
fs.mkdirSync(path.join(root, 'other'), { recursive: true });

fs.writeFileSync(path.join(root, 'raw/assets/visual-prompt-system/圣诞夜雪街追逐/实测成片.mp4'), 'v');
fs.writeFileSync(path.join(root, 'raw/assets/visual-prompt-system/圣诞夜雪街追逐/图片1.png'), 'a');
fs.writeFileSync(path.join(root, 'other/同名.png'), 'b');
fs.mkdirSync(path.join(root, 'more'), { recursive: true });
fs.writeFileSync(path.join(root, 'more/同名.png'), 'c');
fs.writeFileSync(path.join(root, 'other/同名.png.bak'), 'x'); // 非唯一名干扰项
fs.writeFileSync(path.join(root, 'library/visual-prompt-system/模板-微表情特写.md'), '# t');
const caseFile = path.join(root, 'library/visual-prompt-system/案例-某案例.md');
fs.writeFileSync(caseFile, '# t');
fs.writeFileSync(path.join(root, 'library/visual-prompt-system/相对示例.png'), 'c');

const index = buildWikiIndex(root);

test('Obsidian 嵌入：Wiki 根相对路径优先', () => {
  const r = resolveObsidianMedia(index, 'raw/assets/visual-prompt-system/圣诞夜雪街追逐/实测成片.mp4');
  assert.equal(r.status, 'ok');
  assert.equal(r.matchedBy, 'wiki-root-path');
  assert.equal(r.absPath, path.join(root, 'raw/assets/visual-prompt-system/圣诞夜雪街追逐/实测成片.mp4'));
});

test('Obsidian 嵌入：仅文件名时按全库唯一匹配', () => {
  const r = resolveObsidianMedia(index, '图片1.png');
  assert.equal(r.status, 'ok');
  assert.equal(r.matchedBy, 'unique-filename');
});

test('Obsidian 嵌入：同名多处 → 歧义；无命中 → 缺失', () => {
  const dup = resolveObsidianMedia(index, '同名.png');
  assert.equal(dup.status, 'ambiguous');
  assert.equal(dup.candidates.length, 2, 'other/ 与 more/ 两个同名文件');
  const missing = resolveObsidianMedia(index, '不存在.png');
  assert.equal(missing.status, 'missing');
});

test('Markdown 相对路径图片：先按源文件目录解析', () => {
  const rel = path.join(root, 'library/visual-prompt-system/x.md');
  const r = resolveRelativeMediaInWiki(index, rel, '../../raw/assets/visual-prompt-system/圣诞夜雪街追逐/图片1.png');
  assert.equal(r.status, 'ok');
  assert.equal(r.matchedBy, 'source-relative');
  const local = resolveRelativeMediaInWiki(index, rel, './相对示例.png');
  assert.equal(local.status, 'ok');
  assert.equal(local.matchedBy, 'source-relative');
});

test('文档链接：目标、锚点与别名的拆分', () => {
  const plain = parseWikiLink('模板-微表情特写');
  assert.equal(plain.target, '模板-微表情特写');
  assert.equal(plain.anchor, '');
  assert.equal(plain.alias, '');
  const full = parseWikiLink('模板-角色、场景、道具提示词总结构#二、角色四视图|9:16、2×2角色四视图');
  assert.equal(full.target, '模板-角色、场景、道具提示词总结构');
  assert.equal(full.anchor, '二、角色四视图');
  assert.equal(full.alias, '9:16、2×2角色四视图');
});

test('文档链接：链接表命中与未命中', () => {
  const linkMap = new Map([
    ['模板-微表情特写', { url: '/notes/micro-expression-template/', kind: 'note' }],
    ['案例-某案例', { url: '/cases/some-case/', kind: 'case' }],
  ]);
  const ok = resolveDocLink(linkMap, '模板-微表情特写');
  assert.equal(ok.status, 'ok');
  assert.equal(ok.url, '/notes/micro-expression-template/');
  const unresolved = resolveDocLink(linkMap, '👀图片-人物造型-5类');
  assert.equal(unresolved.status, 'unresolved');
});

test('真实 Wiki 索引抽查：成片与参考图可解析', () => {
  const wikiRoot = '/Users/zhiguang/wiki';
  if (!fs.existsSync(wikiRoot)) return;
  const real = buildWikiIndex(wikiRoot);
  const film = resolveObsidianMedia(real, 'raw/assets/visual-prompt-system/圣诞夜雪街追逐/实测成片.mp4');
  assert.equal(film.status, 'ok');
  const ref1 = resolveObsidianMedia(real, 'raw/assets/visual-prompt-system/圣诞夜雪街追逐/图片1-女孩四视图.png');
  assert.equal(ref1.status, 'ok');
  // 圣诞案例同时存在普通版与高清版两张场景图，按文件名检索时可区分
  const normal = resolveObsidianMedia(real, '图片2-雪夜街道场景.jpg');
  assert.equal(normal.status, 'ok');
  const hd = resolveObsidianMedia(real, '图片2-雪夜街道场景-高清版.jpg');
  assert.equal(hd.status, 'ok');
});
