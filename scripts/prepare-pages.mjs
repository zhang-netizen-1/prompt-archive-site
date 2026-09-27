// 将公开构建复制为 GitHub Pages 项目站点可直接发布的静态目录。
// 仅改写 HTML 资源/导航属性和 CSS 绝对资源路径；提示词正文与复制文本不变。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const basePath = '/prompt-archive-site';

export function prefixHtmlUrls(html, base = basePath) {
  return html.replace(/\b(href|src|poster)=(["'])\/(?!\/)([^"']*)\2/g, (match, attr, quote, rest) => {
    if (rest === base.slice(1) || rest.startsWith(`${base.slice(1)}/`)) return match;
    return `${attr}=${quote}${base}/${rest}${quote}`;
  });
}

export function prefixCssUrls(css, base = basePath) {
  return css.replace(/url\(\s*(["']?)\/(?!\/)([^)'"\s]+)\1\s*\)/g, (match, quote, rest) => {
    if (rest === base.slice(1) || rest.startsWith(`${base.slice(1)}/`)) return match;
    return `url(${quote}${base}/${rest}${quote})`;
  });
}

export function preparePages(sourceDir, targetDir, base = basePath) {
  if (!/^\/[a-z0-9-]+$/i.test(base)) throw new Error(`无效项目路径：${base}`);
  if (!fs.existsSync(path.join(sourceDir, 'index.html'))) throw new Error('找不到构建产物 index.html');
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  let htmlCount = 0;
  let cssCount = 0;
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (entry.name.endsWith('.html')) {
        fs.writeFileSync(full, prefixHtmlUrls(fs.readFileSync(full, 'utf8'), base));
        htmlCount += 1;
      } else if (entry.name.endsWith('.css')) {
        fs.writeFileSync(full, prefixCssUrls(fs.readFileSync(full, 'utf8'), base));
        cssCount += 1;
      }
    }
  }
  visit(targetDir);
  fs.writeFileSync(path.join(targetDir, '.nojekyll'), '');
  return { htmlCount, cssCount };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = preparePages(path.join(projectRoot, 'dist'), path.join(projectRoot, 'pages-dist'));
  console.log(`[pages] ${result.htmlCount} HTML · ${result.cssCount} CSS · ${basePath}/`);
}
