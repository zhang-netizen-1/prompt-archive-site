// 只读读取源 Markdown：frontmatter、标题树与围栏代码块的原文切片。
// 围栏内文字一律用源字符串偏移切片取得，不经过任何 Markdown 重新序列化，
// 以保证「复制全文」与源提示词逐字一致。
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * @param {string} filePath 源文件的绝对路径
 * @returns {{ frontmatter: object, body: string, headings: Array<{text:string, level:number, line:number}>, fencedBlocks: Array<FencedBlock> }}
 * @typedef {Object} FencedBlock
 * @property {string} lang 围栏语言标记（如 text / markdown）
 * @property {string} raw 围栏内原文（含首尾换行，逐字切片）
 * @property {number} startLine 起始行（1 起计，指 ``` 行）
 * @property {number} endLine 结束行（指关闭 ``` 行）
 * @property {string[]} headingPath 围栏所在位置的标题路径（不含文件 H1 之前的空档）
 */
export function readSource(filePath) {
  const abs = path.resolve(filePath);
  const rawFile = fs.readFileSync(abs, 'utf8');
  const parsed = matter(rawFile);
  const body = parsed.content;
  const lines = body.split('\n');

  const headings = [];
  const fencedBlocks = [];
  let offset = 0;
  let fence = null; // { lang, rawStart, startLine, headingPath }
  let headingStack = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineStart = offset;

    if (fence) {
      const closeMatch = line.match(/^\s*(`{3,}|~{3,})\s*$/);
      if (closeMatch && closeMatch[1][0] === fence.marker[0]) {
        const rawEnd = lineStart; // 关闭围栏行之前的位置
        fencedBlocks.push({
          lang: fence.lang,
          raw: body.slice(fence.rawStart, rawEnd),
          startLine: fence.startLine,
          endLine: i + 1,
          headingPath: fence.headingPath,
        });
        fence = null;
      }
    } else {
      const openMatch = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
      if (openMatch) {
        fence = {
          marker: openMatch[1],
          lang: openMatch[2].trim(),
          rawStart: offset + line.length + 1, // 越过本行换行符
          startLine: i + 1,
          headingPath: headingStack.map((h) => h.text),
        };
      } else {
        const headingMatch = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const text = headingMatch[2];
          while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
            headingStack.pop();
          }
          headingStack.push({ level, text });
          headings.push({ text, level, line: i + 1 });
        }
      }
    }

    offset += line.length + 1;
  }

  // 文件结束时仍在围栏内：按 CommonMark 语义延伸到文末收口（源库存在结尾多余的空围栏）。
  if (fence) {
    fencedBlocks.push({
      lang: fence.lang,
      raw: body.slice(fence.rawStart),
      startLine: fence.startLine,
      endLine: lines.length,
      headingPath: fence.headingPath,
    });
  }

  return { frontmatter: parsed.data, body, headings, fencedBlocks };
}

function normalizeHeading(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 在指定标题路径下查找围栏块。多段案例用 section 定位小节。
 * 找不到或匹配到多个时抛错，绝不静默返回空提示词。
 * @param {{ headings: Array, fencedBlocks: FencedBlock[] }} source readSource 的返回值
 * @param {{ heading: string, section?: string, index?: number }} spec
 */
export function findFencedBlock(source, spec) {
  const heading = normalizeHeading(spec.heading);
  const section = spec.section ? normalizeHeading(spec.section) : null;
  const wanted = section ? [heading, section] : [heading];

  const matches = source.fencedBlocks.filter((block) => {
    const pathTexts = block.headingPath.map(normalizeHeading);
    if (wanted.length > pathTexts.length) return false;
    const suffix = pathTexts.slice(pathTexts.length - wanted.length);
    return suffix.every((text, i) => text === wanted[i]);
  });

  if (matches.length === 0) {
    throw new Error(`未找到提示词围栏：heading="${spec.heading}"${spec.section ? ` section="${spec.section}"` : ''}`);
  }
  if (matches.length > 1) {
    const idx = spec.index ?? 0;
    if (idx >= matches.length) {
      throw new Error(`提示词围栏序号越界：heading="${spec.heading}" 共 ${matches.length} 个匹配，index=${idx}`);
    }
    return matches[idx];
  }
  return matches[0];
}
