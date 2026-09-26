// 取值表规范化单元测试：结构修正 + 取值速拷逐字一致。
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeValueTables } from '../scripts/lib/export.mjs';

test('Obsidian 分隔行在前的表格：重排为标准表格并追加取值速拷', () => {
  const md = [
    '|---|---|---|',
    '|**情绪**|**seedance2.0提示词**|**时长（s）**|',
    '|瞳孔扩散|瞳孔微微扩散<!-- v:xmv272 -->|0.5|',
    '|眼睑颤动|下眼睑轻轻颤动|0.5s|',
  ].join('\n');
  const r = normalizeValueTables(md);
  // 表头提到分隔行之前
  const lines = r.markdown.split('\n');
  assert.equal(lines[0], '|**情绪**|**seedance2.0提示词**|**时长（s）**|');
  assert.equal(lines[1], '|---|---|---|');
  // 速拷块逐字保留取值（含 HTML 注释标记）
  assert.ok(r.markdown.includes('**取值速拷（2 条 · 与上表逐字一致）**'));
  assert.ok(r.markdown.includes('瞳孔微微扩散<!-- v:xmv272 -->'));
  assert.ok(r.markdown.includes('下眼睑轻轻颤动'));
  assert.equal(r.copyBlocks, 1);
});

test('无分隔行的两列全取值表：补表头，全部取值进入速拷块', () => {
  const md = [
    '**刀/剑**（特效变量库·节选 4 条）',
    '',
    '|**握刀蓄势**|刀身震颤溅出细碎熔岩火星。|',
    '|**旋刀**|旋刀划出完整圆形赤红烈焰刀光。|',
  ].join('\n');
  const r = normalizeValueTables(md);
  assert.ok(r.markdown.includes('| 取值 | 提示词 |'));
  assert.ok(r.markdown.includes('刀身震颤溅出细碎熔岩火星。'), '首行取值也进入速拷');
  assert.ok(r.markdown.includes('旋刀划出完整圆形赤红烈焰刀光。'));
  assert.equal(r.copyBlocks, 1);
});

test('无分隔行但有提示词表头的表格：首行为表头，取值从第二行开始', () => {
  const md = [
    '|**运镜描述**|**seedance2.0提示词**|**适用场景**|',
    '|贴身平行极速横移运镜→主体躯干纵向锁焦跟拍|贴身平行极速横移运镜，躯干纵向锁焦，高速拳脚攻防|拳脚 / 短兵器|',
  ].join('\n');
  const r = normalizeValueTables(md);
  assert.ok(r.markdown.includes('贴身平行极速横移运镜，躯干纵向锁焦，高速拳脚攻防'));
  assert.ok(!r.markdown.includes('**seedance2.0提示词**\n'), '表头单元格不进入速拷');
  assert.equal(r.copyBlocks, 1);
});

test('普通规则表（无提示词列）只修结构、不加快拷块', () => {
  const md = [
    '| 符号 | 停顿／语调 | 听感、情绪 | 风险 |',
    '|---|---|---|---|',
    '| 句号 。 | 句末停顿（更长）＋降调 | 收束、笃定 | 分句一多＝节奏偏移风险 |',
  ].join('\n');
  const r = normalizeValueTables(md);
  assert.equal(r.copyBlocks, 0);
  assert.ok(!r.markdown.includes('取值速拷'));
  // 标准形式保持不变
  assert.ok(r.markdown.includes('|---|---|---|---|'));
});

test('围栏内的管道行不被当作表格', () => {
  const md = [
    '```text',
    '|**假表头**|**seedance2.0提示词**|',
    '|假取值|假取值内容|',
    '```',
  ].join('\n');
  const r = normalizeValueTables(md);
  assert.equal(r.copyBlocks, 0);
  assert.ok(!r.markdown.includes('取值速拷'));
  assert.ok(r.markdown.includes('|假取值|假取值内容|'), '围栏内原文不动');
});

test('非标准表格与标准表格的原始单元格文本逐字保留', () => {
  const md = [
    '|---|---|',
    '|**场景句**|**seedance2.0提示词**|',
    '|隐忍笃定|眉头微蹙，下颌紧绷，眼神从悲悯渐变为临危不乱的笃定|',
  ].join('\n');
  const r = normalizeValueTables(md);
  assert.ok(r.markdown.includes('眉头微蹙，下颌紧绷，眼神从悲悯渐变为临危不乱的笃定'));
  assert.equal(r.markdown.split('眉头微蹙').length - 1, 2, '表格与速拷块各出现一次，文本一致');
});
