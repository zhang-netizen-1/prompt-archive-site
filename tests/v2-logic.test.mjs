import test from 'node:test';
import assert from 'node:assert/strict';
import * as display from '../src/lib/catalog-display.mjs';

test('场景从真实主题统计，阈值3，数量降序，同数按中文名称排序', () => {
  const items = ['甲', '乙', '甲', '乙', '甲', '乙', '丙', '', null].map(topic => ({ topic }));
  assert.equal(display.SCENARIO_MIN_COUNT, 3);
  assert.deepEqual(display.scenarioChips(items), ['甲', '乙'].sort((a,b) => a.localeCompare(b, 'zh-Hans-CN')).map(topic => ({ topic, count: 3 })));
  assert.deepEqual(display.scenarioChips([]), []);
  assert.deepEqual(display.scenarioChips([...items, { topic: '甲' }])[0], { topic: '甲', count: 4 });
});

test('卡片只允许单段复制，原始字符逐字保留，包括空字符串', () => {
  const raw = ' \n原文\r\n <script> & “字符”\t\n';
  assert.equal(display.cardCopyPayload({ promptBlocks: [{ raw }], fullPrompt: '不可使用' }), raw);
  assert.equal(display.cardCopyPayload({ promptBlocks: [{ raw: '' }] }), '');
  assert.equal(display.cardCopyPayload({ promptBlocks: [{ raw }, { raw }] }), null);
  assert.equal(display.cardCopyPayload({ promptBlocks: [] }), null);
});

test('状态筛选归并参考图与无记录，同组均可匹配', () => {
  const items = ['reference-only', 'no-record', 'source-example', 'author-tested'].map(evidence => ({ evidence, medium: 'image' }));
  assert.deepEqual(display.getFilterOptions(items, 'evidence').map(o => o.label).sort(), ['仅提示词', '作者称已测', '源资料示例'].sort());
  assert.equal(display.pageMatches(items, { evidence: 'no-record' }).matches.length, 2);
});
