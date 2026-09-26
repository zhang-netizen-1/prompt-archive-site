// 导出命令入口：SITE_MODE=public|preview（默认 preview）。
import { exportWiki } from './lib/export.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wikiRoot = process.env.WIKI_ROOT ?? '/Users/zhiguang/wiki';
const mode = process.env.SITE_MODE === 'public' ? 'public' : 'preview';

const report = await exportWiki({ wikiRoot, projectRoot, mode });

const lines = [
  `[export] mode=${mode} wiki=${wikiRoot}`,
  `[export] 案例 ${report.counts.cases} 篇 · 笔记 ${report.counts.notes} 篇 · 媒体 ${report.counts.media} 个 · 合集 ${report.counts.collections} 个`,
];
if (report.excludedFromPublic.length) {
  lines.push(`[export] 未进入公开构建的条目：${report.excludedFromPublic.map((e) => `${e.kind}:${e.slug}`).join(', ')}`);
}
if (report.warnings.length) {
  lines.push(`[export] 警告 ${report.warnings.length} 条（详见 src/generated/report.json）`);
}
for (const e of report.errors) {
  lines.push(`[export] 错误 [${e.type}] ${e.message}${e.entry ? `（${e.entry}）` : ''}`);
}
console.log(lines.join('\n'));
if (report.errors.length) process.exitCode = 1;
