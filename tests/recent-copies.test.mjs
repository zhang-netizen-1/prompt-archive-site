import test from 'node:test';
import assert from 'node:assert/strict';

const logic = () => import('../src/lib/recent-copies.mjs');
const entry = (slug, t = 1) => ({ slug, title: `标题 ${slug}`, href: `/prompt-archive-site/cases/${slug}/`, t });

test('最近复制按时间降序、按slug去重、最多8条，保留base path', async () => {
  const { addRecentCopy } = await logic();
  const list = Array.from({ length: 10 }, (_, i) => entry(String(i), i));
  const result = addRecentCopy(list, entry('3', 20));
  assert.equal(result.length, 8);
  assert.deepEqual(result.map(x => x.slug), ['3', '9', '8', '7', '6', '5', '4', '2']);
  assert.equal(result[0].href, '/prompt-archive-site/cases/3/');
  assert.equal(list.length, 10);
});

test('损坏JSON或结构重置，拒绝外站和脚本链接', async () => {
  const { parseRecentCopies } = await logic();
  for (const value of ['{', '{}', 'null', '[{}]']) assert.deepEqual(parseRecentCopies(value), []);
  for (const href of ['//evil.test/', 'javascript:alert(1)', '/\\evil.test/', '/cases/\nxx']) {
    assert.deepEqual(parseRecentCopies(JSON.stringify([{ ...entry('x'), href }])), []);
  }
});

test('存储不可用静默失败；损坏数据重置；记录与清空', async () => {
  const { readRecentCopies, recordRecentCopy, clearRecentCopies, RECENT_COPIES_KEY } = await logic();
  const broken = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
  assert.equal(readRecentCopies(broken), null);
  assert.equal(recordRecentCopy(broken, entry('x')), null);
  assert.equal(clearRecentCopies(broken), false);
  const values = new Map([[RECENT_COPIES_KEY, '{']]);
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  assert.deepEqual(readRecentCopies(storage), []);
  assert.equal(values.has(RECENT_COPIES_KEY), false);
  assert.deepEqual(recordRecentCopy(storage, entry('x')), [entry('x')]);
  assert.equal(clearRecentCopies(storage), true);
  assert.deepEqual(readRecentCopies(storage), []);
});
