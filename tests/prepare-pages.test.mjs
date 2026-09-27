import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { preparePages } from '../scripts/prepare-pages.mjs';

test('Pages 发布目录补全项目路径且保留提示词正文', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-pages-'));
  const source = path.join(root, 'dist');
  const target = path.join(root, 'pages-dist');
  fs.mkdirSync(path.join(source, '_astro'), { recursive: true });
  fs.writeFileSync(path.join(source, 'index.html'),
    '<a href="/cases/">案例</a><img src="/media/a.png"><video poster="/media/p.png"></video><a href="https://example.com/">外链</a><pre>href=&quot;/cases/&quot;</pre>');
  fs.writeFileSync(path.join(source, '_astro/site.css'), "@font-face{src:url('/fonts/a.woff2')}body{background:url(data:image/png;base64,AAAA)}");
  try {
    const result = preparePages(source, target);
    assert.equal(result.htmlCount, 1);
    assert.equal(result.cssCount, 1);
    const html = fs.readFileSync(path.join(target, 'index.html'), 'utf8');
    assert.ok(html.includes('href="/prompt-archive-site/cases/"'));
    assert.ok(html.includes('src="/prompt-archive-site/media/a.png"'));
    assert.ok(html.includes('poster="/prompt-archive-site/media/p.png"'));
    assert.ok(html.includes('href="https://example.com/"'));
    assert.ok(html.includes('<pre>href=&quot;/cases/&quot;</pre>'));
    assert.ok(fs.readFileSync(path.join(target, '_astro/site.css'), 'utf8').includes("url('/prompt-archive-site/fonts/a.woff2')"));
    assert.ok(fs.existsSync(path.join(target, '.nojekyll')));
    assert.ok(fs.readFileSync(path.join(source, 'index.html'), 'utf8').includes('href="/cases/"'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
