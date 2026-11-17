import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import matter from 'gray-matter';
import { markdownToHtml } from 'satteri';
import config from '../astro.config.mjs';

const options = config.markdown.processor.options;

function assertScrollableTables(markdown, label) {
  const { html } = markdownToHtml(markdown, options);
  const tables = [...html.matchAll(/<table[\s>]/g)].length;
  const wrapped = [...html.matchAll(/<div class="table-scroll"><table[\s>]/g)].length;
  assert.equal(wrapped, tables, `${label}: 每张表都应有独立滚动容器`);
  return { html, tables };
}

test('Markdown 多张表独立包装，保留单元格、链接和代码块原文', () => {
  const markdown = '| 字段 | 定义 | 构成公式 | 回答的问题 |\n|---|---|---|---|\n| 参考图（可选） | 内容 | A + B | 哪张图？ |\n\n'
    + '```html\n<table><tr><td>代码原文</td></tr></table>\n```\n\n'
    + '> | 标签 | 说明 |\n> |---|---|\n> | 光线设计 | [链接](/notes/example/) |';
  const { html, tables } = assertScrollableTables(markdown, '混合内容');
  assert.equal(tables, 2);
  const baseline = markdownToHtml(markdown, { ...options, hastPlugins: [] }).html;
  assert.equal(html.replaceAll('<div class="table-scroll">', '').replaceAll('</table></div>', '</table>'), baseline);
});

test('全部生成笔记中的 Markdown 表格都获得独立滚动容器', () => {
  const directory = new URL('../src/generated/notes/', import.meta.url);
  let notesWithTables = 0;
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.md'))) {
    const { content } = matter(fs.readFileSync(new URL(file, directory), 'utf8'));
    const { tables } = assertScrollableTables(content, file);
    if (tables) notesWithTables += 1;
  }
  assert.ok(notesWithTables > 0);
});
