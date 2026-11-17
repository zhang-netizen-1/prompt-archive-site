import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const color = name => css.match(new RegExp(`--${name}:\\s*#([\\da-f]{6})`, 'i'))[1].match(/../g).map(n => parseInt(n, 16));
const luminance = rgb => rgb.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
  .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test('桌面最亮背景上文字达4.5；纸面焦点和跳转链接达标', () => {
  // 保守上界：噪点取纯白（实际噪点更暗），叠加顶部白色渐变的最大不透明度。
  const grainAlpha = Number(css.match(/--grain-fine:.*opacity='([\d.]+)'/)[1]);
  const gradientAlpha = Number(css.match(/radial-gradient\(120% 90% at 50% 0%, rgba\(255,255,255,([\d.]+)\)/)[1]);
  const brightest = color('desk').map(value => {
    const base = value / 255;
    const whiteSoftLight = base <= .25 ? ((16 * base - 12) * base + 4) * base : Math.sqrt(base);
    return ((base * (1 - grainAlpha) + whiteSoftLight * grainAlpha) * (1 - gradientAlpha) + gradientAlpha) * 255;
  });
  assert.ok(contrast(color('chalk-2'), brightest) >= 4.5);
  assert.match(css, /\.breadcrumbs\s*\{[^}]*color: var\(--chalk-2\)/);
  assert.match(css, /\.case-file-no\s*\{[^}]*color: var\(--chalk-2\)/);
  assert.ok(contrast(color('ink'), color('paper')) >= 4.5);
  assert.ok(contrast(color('ink-3'), color('paper')) >= 4.5);
});

test('字号全部引用标尺且不小于12；卡片标题保持单行截断', () => {
  assert.doesNotMatch(css, /font-size:\s*[\d.]+(?:px|em|rem)/);
  const sizes = [...css.matchAll(/--fs-\d+:\s*(\d+)px/g)].map(m => Number(m[1]));
  assert.ok(sizes.every(n => n >= 12));
  assert.match(css, /\.card-title\s*\{[^}]*white-space: nowrap;[^}]*min-width: 0/);
  assert.match(css, /\.card-title-text\s*\{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis/);
});

test('全站 select 共用内缩箭头，保留文字间距、宽度约束与焦点环', () => {
  const select = css.match(/^select\s*\{([^}]+)\}/m)[1];
  assert.match(select, /(?:^|;)\s*appearance: none;/);
  assert.match(select, /-webkit-appearance: none;/);
  assert.match(select, /padding: var\(--sp-8\) var\(--sp-32\) var\(--sp-8\) var\(--sp-12\);/);
  assert.match(select, /background-color: var\(--paper\);/);
  assert.match(select, /background-repeat: no-repeat;/);
  assert.match(select, /background-position: right 12px center;/);
  assert.match(select, /background-size: 10px 6px;/);
  assert.match(select, /min-height: 40px;/);
  assert.match(select, /line-height: 1\.5;/);
  assert.match(select, /min-width: 0; max-width: 100%;/);
  assert.match(css, /:focus-visible\s*\{ outline: 2px solid var\(--hl\); outline-offset: 2px; \}/);

  const uri = select.match(/background-image: url\("(data:image\/svg\+xml,[^"]+)"\)/)[1];
  const svg = decodeURIComponent(uri.split(',')[1]);
  assert.match(svg, /width='10' height='6' viewBox='0 0 10 6'/);
  assert.match(svg, /d='M0\.75 0\.75 5 5\.25 9\.25 0\.75'/);
  const stroke = svg.match(/stroke='#([\da-f]{6})'/i)[1].match(/../g).map(n => parseInt(n, 16));
  assert.deepEqual(stroke, color('ink'));
  assert.ok(contrast(stroke, color('paper')) >= 3);
});
