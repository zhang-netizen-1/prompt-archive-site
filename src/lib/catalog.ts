// 站点数据层：读取导出的结构化数据，提供查询与展示映射。
import casesJson from '../generated/cases.json';
import notesJson from '../generated/notes.json';
import collectionsJson from '../generated/collections.json';

export type Medium = 'image' | 'video';

export interface CaseMedia {
  role: 'result' | 'reference' | 'example';
  kind: 'image' | 'video';
  label: string;
  url: string;
  poster?: string | null;
}

export interface PromptBlockData {
  label: string;
  heading: string;
  section: string | null;
  raw: string;
  sourceLines: [number, number];
}

export interface ChainLink {
  slug: string;
  relation: '前置资产' | '后续成片' | string;
}

export interface CaseItem {
  slug: string;
  archiveNo: string;
  title: string;
  sourceDisplay: string;
  medium: Medium;
  topic: string;
  tags: string[];
  evidence: string;
  duration: string | null;
  summary: string;
  media: CaseMedia[];
  provenance: { testedNote?: string; mediaNote?: string };
  relatedNotes: string[];
  collection: string | null;
  chain: ChainLink[];
  featured: boolean;
  approvedForPublic: boolean;
  promptBlocks: PromptBlockData[];
  fullPrompt: string | null;
  searchText: string;
}

export interface NoteTocEntry {
  depth: number;
  text: string;
  slug: string;
}

export interface NoteItem {
  slug: string;
  title: string;
  summary: string;
  category: string;
  medium: Medium | 'mixed';
  sourceDisplay: string;
  approvedForPublic: boolean;
  featured: boolean;
  toc: NoteTocEntry[];
  searchText: string;
  relatedCases: string[];
}

export interface CollectionItem {
  slug: string;
  title: string;
  description: string;
  sourceDisplay: string;
  caseSlugs: string[];
  approvedForPublic: boolean;
}

const caseData = casesJson as { mode: string; cases: CaseItem[] };
const noteData = notesJson as { mode: string; notes: NoteItem[] };
const collectionData = collectionsJson as { mode: string; collections: CollectionItem[] };

export const siteMode = caseData.mode;

export function getAllCases(): CaseItem[] {
  return caseData.cases;
}

export function getCase(slug: string): CaseItem | undefined {
  return caseData.cases.find((c) => c.slug === slug);
}

export function getCasesByMedium(medium: Medium): CaseItem[] {
  return caseData.cases.filter((c) => c.medium === medium);
}

export function getAllNotes(): NoteItem[] {
  return noteData.notes;
}

export function getNote(slug: string): NoteItem | undefined {
  return noteData.notes.find((n) => n.slug === slug);
}

export function getAllCollections(): CollectionItem[] {
  return collectionData.collections;
}

export function getCollection(slug: string): CollectionItem | undefined {
  return collectionData.collections.find((c) => c.slug === slug);
}

export function getFeaturedCases(): CaseItem[] {
  return caseData.cases.filter((c) => c.featured);
}

export function getTopics(medium?: Medium): string[] {
  const set = new Set<string>();
  for (const c of caseData.cases) {
    if (!medium || c.medium === medium) set.add(c.topic);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

/** 案例按媒介内的排列顺序取前后案例，用于上一/下一导航。 */
export function getCaseNeighbors(item: CaseItem): { prev?: CaseItem; next?: CaseItem } {
  const list = getCasesByMedium(item.medium);
  const idx = list.findIndex((c) => c.slug === item.slug);
  return {
    prev: idx > 0 ? list[idx - 1] : undefined,
    next: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : undefined,
  };
}

/** 证据状态 → 列表卡片上的媒体身份文案（视频与图像措辞不同）。 */
export function evidenceLabel(item: Pick<CaseItem, 'evidence' | 'medium'>): { text: string; tone: 'ok' | 'plain' | 'copper' } {
  const isVideo = item.medium === 'video';
  switch (item.evidence) {
    case 'film-attached':
      return { text: '附实测成片', tone: 'ok' };
    case 'result-attached':
      return { text: '附结果图', tone: 'ok' };
    case 'author-tested':
      return { text: isVideo ? '作者称已测试 · 未附成片' : '作者称已测试 · 未附结果图', tone: 'copper' };
    case 'source-example':
      return { text: isVideo ? '附源资料示例视频' : '附源资料示例图', tone: 'copper' };
    case 'reference-only':
      return { text: isVideo ? '有参考图 · 未附成片' : '有参考图 · 未附结果图', tone: 'plain' };
    case 'no-record':
    default:
      return { text: isVideo ? '暂无成片' : '暂无结果图', tone: 'plain' };
  }
}

/** 案例页「来源与结果」里展示的实测依据标准句。 */
export function evidenceStatement(item: CaseItem): { text: string; tone: 'ok' | 'warn' } {
  switch (item.evidence) {
    case 'film-attached':
      return { text: '附实测成片，可在本页播放核对。', tone: 'ok' };
    case 'author-tested':
      return { text: '作者称已测试；本站未复测，未附成片。', tone: 'warn' };
    case 'source-example':
      return { text: '源资料附示例视频/示例图；本站未复现，不作为生成结果展示。', tone: 'warn' };
    case 'result-attached':
      return { text: '附结果图，已与提示词对应核对。', tone: 'ok' };
    case 'reference-only':
      return { text: '仅有输入参考图，未附生成结果。', tone: 'warn' };
    default:
      return { text: '源文未见实测记录。', tone: 'warn' };
  }
}

/** 媒体角色 → 面板身份标签。 */
export function mediaRoleLabel(m: CaseMedia): string {
  if (m.role === 'result' && m.kind === 'video') return '实测成片';
  if (m.role === 'result') return '生成结果图';
  if (m.role === 'reference') return '输入参考图';
  if (m.role === 'example' && m.kind === 'video') return '源资料示例视频';
  return '源资料示例图';
}

export function mediumLabel(medium: Medium | 'mixed'): string {
  if (medium === 'image') return '图像案例';
  if (medium === 'video') return '视频案例';
  return '共用';
}
