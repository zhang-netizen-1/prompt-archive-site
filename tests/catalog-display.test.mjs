import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as display from '../src/lib/catalog-display.mjs';

const catalog = JSON.parse(fs.readFileSync(new URL('../content/catalog.json', import.meta.url)));
const media = (role, kind) => ({ role, kind, url: '/media/existing.png' });

test('状态徽标使用统一词汇，实测附件共用附实测前缀', () => {
  const expected = {
    'film-attached': '附实测成片',
    'result-attached': '附实测结果图',
    'source-example': '源资料示例',
    'author-tested': '作者称已测',
    'no-record': '仅提示词',
    'reference-only': '仅提示词',
  };
  for (const [evidence, label] of Object.entries(expected)) {
    assert.equal(display.evidenceLabel({ evidence }).text, label);
    assert.equal(display.getFilterOptions([{ evidence }], 'evidence')[0].label, label);
  }
});

test('附件状态须有对应角色和类型；作者声明保持原样', () => {
  for (const evidence of ['source-example', 'result-attached', 'film-attached', 'reference-only']) {
    assert.equal(display.deriveEvidence({ evidence, medium: 'image', media: [] }), 'no-record');
  }
  assert.equal(display.deriveEvidence({ evidence: 'author-tested', media: [] }), 'author-tested');
  assert.equal(display.deriveEvidence({ evidence: 'film-attached', media: [media('reference', 'video')] }), 'no-record');
  assert.equal(display.deriveEvidence({ evidence: 'film-attached', media: [media('result', 'image')] }), 'no-record');
  assert.equal(display.deriveEvidence({ evidence: 'film-attached', media: [media('result', 'video')] }), 'film-attached');
  assert.equal(display.deriveEvidence({ evidence: 'result-attached', media: [media('result', 'image')] }), 'result-attached');
  assert.equal(display.deriveEvidence({ evidence: 'source-example', medium: 'image', media: [media('reference', 'image')] }), 'no-record');
  assert.equal(display.deriveEvidence({ evidence: 'source-example', medium: 'image', media: [media('example', 'image')] }), 'source-example');
});

test('现有五条无图案例与筛选选项一致，筛选项均有匹配内容', () => {
  // 清单 ref 对应已有附件；此处只检验显示规则，不生成媒体。
  const items = catalog.cases.map(c => ({ ...c, evidence: display.deriveEvidence(c) }));
  const images = items.filter(c => c.medium === 'image');
  assert.deepEqual(images.filter(c => c.evidence === 'no-record').map(c => c.slug).sort(), [
    'scene-360-panorama', 'realistic-portrait-freckles', 'realistic-portrait-hk-glam',
    'realistic-portrait-yujie', 'realistic-portrait-pure-innocent',
  ].sort());
  for (const list of [items, images, items.filter(c => c.medium === 'video')]) {
    for (const field of ['evidence', 'topic', 'medium']) {
      const options = display.getFilterOptions(list, field);
      assert.equal(new Set(options.map(o => o.value)).size, options.length);
      for (const option of options) assert.ok(list.some(c => (field === 'evidence' ? display.evidenceKey(c[field]) : c[field]) === option.value));
    }
  }
  assert.ok(!display.getFilterOptions(images, 'evidence').some(o => o.value === 'result-attached'));
  assert.equal(display.getFilterOptions(images, 'evidence').find(o => o.value === 'no-record').label, '仅提示词');
  assert.deepEqual(display.getFilterOptions([], 'topic'), []);
});

test('笔记计数只取索引的四类；未列出的笔记保留', () => {
  const listed = display.listedNotes(catalog.notes);
  assert.equal(listed.length, 30);
  assert.equal(catalog.notes.length, 60);
  assert.ok(listed.every(n => ['模板', '变量库', '方法', '规则'].includes(n.category)));
  assert.deepEqual(display.listedNotes([{ category: '规则' }, { category: '其他' }]), [{ category: '规则' }]);
});

test('分页按全部匹配计数，每次增加24条；切换条件可重置', () => {
  const items = Array.from({ length: 55 }, (_, i) => ({ medium: i < 30 ? 'video' : 'image', topic: '节日', searchText: '圣诞 雪景' }));
  assert.deepEqual(display.pageMatches(items, {}, 24), { matches: items, shown: items.slice(0, 24), remaining: 31 });
  assert.equal(display.pageMatches(items, {}, 48).remaining, 7);
  const filtered = display.pageMatches(items, { medium: 'video', query: '圣诞 雪景' }, 24);
  assert.equal(filtered.matches.length, 30);
  assert.equal(filtered.shown.length, 24);
  assert.equal(filtered.remaining, 6);
  assert.equal(display.pageMatches(items, { query: '不存在' }, 24).matches.length, 0);
});

test('高亮分段保留原始文本；中文、大小写和HTML均按纯文本处理', () => {
  const text = '<img onerror="alert(1)">圣诞 Christmas 圣诞';
  const parts = display.highlightParts(text, '圣诞 christmas');
  assert.equal(parts.map(p => p.text).join(''), text);
  assert.deepEqual(parts.filter(p => p.match).map(p => p.text), ['圣诞', 'Christmas', '圣诞']);
  assert.deepEqual(display.highlightParts('a.*[b]', '.*[').filter(p => p.match).map(p => p.text), ['.*[']);
  assert.deepEqual(display.highlightParts(text, ''), [{ text, match: false }]);
});
