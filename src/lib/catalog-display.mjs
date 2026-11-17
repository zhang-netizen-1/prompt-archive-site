/** 可在导出、页面和浏览器中共用的纯显示规则。 */
export function deriveEvidence(item) {
  const media = item.media ?? [];
  const required = {
    'source-example': m => m.role === 'example' && m.kind === item.medium,
    'result-attached': m => m.role === 'result' && m.kind === 'image',
    'film-attached': m => m.role === 'result' && m.kind === 'video',
    'reference-only': m => m.role === 'reference' && m.kind === 'image',
  }[item.evidence];
  if (required && !media.some(required)) return 'no-record';
  return item.evidence;
}

export function evidenceKey(evidence) {
  return evidence === 'reference-only' ? 'no-record' : evidence;
}

export function evidenceLabel(item) {
  switch (evidenceKey(item.evidence)) {
    case 'film-attached': return { text: '附实测成片', tone: 'attached', icon: 'play' };
    case 'result-attached': return { text: '附实测结果图', tone: 'attached', icon: 'image' };
    case 'source-example': return { text: '源资料示例', tone: 'source', icon: 'image' };
    case 'author-tested': return { text: '作者称已测', tone: 'author', icon: 'check' };
    default: return { text: '仅提示词', tone: 'plain', icon: 'note' };
  }
}

export const SCENARIO_MIN_COUNT = 3;
export function scenarioChips(items) {
  const counts = new Map();
  for (const { topic } of items) {
    if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count >= SCENARIO_MIN_COUNT)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, 'zh-Hans-CN'));
}

/** 单段复制始终取详情页同一份 raw，绝不回退或拼接。 */
export function cardCopyPayload(item) {
  return item.promptBlocks?.length === 1 ? item.promptBlocks[0].raw : null;
}

export function getFilterOptions(items, field) {
  const values = new Map();
  for (const item of items) {
    const value = field === 'evidence' ? evidenceKey(item[field]) : item[field];
    if (!value || values.has(value)) continue;
    let label = value;
    if (field === 'evidence') label = evidenceLabel(item).text;
    if (field === 'medium') label = value === 'video' ? '视频案例' : '图像案例';
    values.set(value, { value, label });
  }
  return [...values.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'));
}

export const listedNoteCategories = ['模板', '变量库', '方法', '规则'];
export function listedNotes(notes) {
  return notes.filter(note => listedNoteCategories.includes(note.category));
}

export const PAGE_SIZE = 24;
export function queryTerms(query = '') {
  return [...new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean))];
}

export function pageMatches(items, filters = {}, limit = PAGE_SIZE) {
  const terms = queryTerms(filters.query);
  const matches = items.filter(item =>
    ['medium', 'topic', 'evidence'].every(field => !filters[field] || (field === 'evidence' ? evidenceKey(item[field]) === evidenceKey(filters[field]) : item[field] === filters[field]))
    && terms.every(term => (item.searchText ?? '').toLowerCase().includes(term)));
  return { matches, shown: matches.slice(0, limit), remaining: Math.max(0, matches.length - limit) };
}

/** 返回文本分段；调用方用文本节点写入，绝不把用户输入当作 HTML。 */
export function highlightParts(text, query) {
  const terms = queryTerms(query).sort((a, b) => b.length - a.length);
  if (!terms.length) return [{ text, match: false }];
  const escaped = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(escaped.join('|'), 'giu');
  const parts = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > end) parts.push({ text: text.slice(end, match.index), match: false });
    parts.push({ text: match[0], match: true });
    end = match.index + match[0].length;
  }
  if (end < text.length) parts.push({ text: text.slice(end), match: false });
  return parts;
}

