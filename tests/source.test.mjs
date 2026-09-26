// 原文抽取测试：围栏内文字必须与源字符逐字一致。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSource, findFencedBlock } from '../scripts/lib/source.mjs';

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-fixture-'));
const fixturePath = path.join(fixtureDir, 'sample-case.md');

// 精心构造：含 frontmatter、说明段、两个标题层级、两块围栏、中文标点、
// 首尾换行、HTML 注释标记，以及「围栏内出现 # 井号标题」的陷阱。
const fixture = `---
title: 测试案例
medium: video
---

# 测试案例（15秒）

> 来源说明。台词含中文标点：问"你怎么办？"——语气保持。

## 提示词全文

\`\`\`text
【全局设定】

核心风格：测试画面，"引号"与冒号：、顿号；感叹！

<!-- 保留标记 -->

0-2秒：第一镜，微表情。
\`\`\`

## 附录

### 段一

\`\`\`markdown
<!--角色版 -->

# 任务
围栏内的 # 不是标题
\`\`\`

### 段二

\`\`\`text
第二段原文
\`\`\`
`;
fs.writeFileSync(fixturePath, fixture);

test('readSource 解析 frontmatter 与正文', () => {
  const source = readSource(fixturePath);
  assert.equal(source.frontmatter.title, '测试案例');
  assert.equal(source.frontmatter.medium, 'video');
  assert.ok(source.body.startsWith('\n# 测试案例（15秒）'));
});

test('围栏 raw 与源文件字符逐字一致（含首尾换行与注释标记）', () => {
  const source = readSource(fixturePath);
  const block = findFencedBlock(source, { heading: '提示词全文' });
  // 与 fixture 中手写的围栏内容完全一致（首行前有一个换行、末行后有一个换行）
  const expected = '【全局设定】\n\n核心风格：测试画面，"引号"与冒号：、顿号；感叹！\n\n<!-- 保留标记 -->\n\n0-2秒：第一镜，微表情。\n';
  assert.equal(block.raw, expected);
  assert.equal(block.lang, 'text');
});

test('围栏内的 # 行不被误认成标题', () => {
  const source = readSource(fixturePath);
  const texts = source.headings.map((h) => h.text);
  assert.ok(texts.includes('提示词全文'));
  assert.ok(texts.includes('段一'));
  assert.ok(!texts.includes('任务'), '围栏内的 "# 任务" 不应进入标题树');
});

test('按 heading + section 定位小节围栏', () => {
  const source = readSource(fixturePath);
  const a = findFencedBlock(source, { heading: '附录', section: '段一' });
  assert.ok(a.raw.includes('<!--角色版 -->'));
  assert.ok(a.raw.includes('围栏内的 # 不是标题'));
  const b = findFencedBlock(source, { heading: '附录', section: '段二' });
  assert.equal(b.raw, '第二段原文\n');
});

test('找不到或多个匹配时报错，不返回空提示词', () => {
  const source = readSource(fixturePath);
  assert.throws(() => findFencedBlock(source, { heading: '不存在的标题' }), /未找到提示词围栏/);
  // "附录" 下有两个小节围栏，但它们路径都含 [附录]，section 未指明 → 只匹配 [附录] 层级的块
  // 本 fixture 中没有直接位于「附录」下的围栏，因此报未找到
  assert.throws(() => findFencedBlock(source, { heading: '附录' }), /未找到提示词围栏/);
});

test('行号记录可用于核对原文范围', () => {
  const source = readSource(fixturePath);
  const block = findFencedBlock(source, { heading: '提示词全文' });
  const lines = source.body.split('\n');
  const fenceLangLine = lines[block.startLine - 1];
  const fenceCloseLine = lines[block.endLine - 1];
  assert.match(fenceLangLine, /^```text$/);
  assert.equal(fenceCloseLine, '```');
});

test('对真实源文件的抽取抽查：圣诞夜雪街追逐', () => {
  const realPath = '/Users/zhiguang/wiki/library/visual-prompt-system/案例-圣诞夜雪街追逐.md';
  if (!fs.existsSync(realPath)) return; // 本机之外跳过
  const source = readSource(realPath);
  const block = findFencedBlock(source, { heading: '提示词全文' });
  assert.ok(block.raw.startsWith('【全局设定】'));
  assert.ok(block.raw.trimEnd().endsWith('环境音：落地闷响、鹿铃远去、轻快圣诞音乐渐起。'));
  const sunset = readSource('/Users/zhiguang/wiki/library/visual-prompt-system/案例-一天四十三次日落.md');
  const seg1 = findFencedBlock(sunset, { heading: '提示词全文', section: '① 早高峰人行道（14.5 秒）' });
  assert.ok(seg1.raw.includes('【全局设定】'));
  const seg6 = findFencedBlock(sunset, { heading: '提示词全文', section: '⑥ 江边步道·落点（11 秒）' });
  assert.ok(seg6.raw.includes('【镜头】'));
});
