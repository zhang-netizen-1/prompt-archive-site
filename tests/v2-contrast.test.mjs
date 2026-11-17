import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const rgb = name => css.match(new RegExp(`--${name}:\\s*#([\\da-f]{6})`, 'i'))[1].match(/../g).map(n => parseInt(n, 16));
const luminance = values => values.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126,.7152,.0722][i], 0);
const contrast = (a,b) => (Math.max(luminance(a),luminance(b)) + .05) / (Math.min(luminance(a),luminance(b)) + .05);

test('v2 墨字、反馈、状态和导航在实际实色背景上均达到4.5:1', () => {
  const pairs = [
    ['ink','paper'], ['ink-2','paper'], ['ink-3','paper'], ['green','paper'],
    ['ink','hl'], ['ink-2','cover-video'], ['ink','cover-video'],
    ['ink-2','cover-image'], ['ink','cover-image'], ['chalk','desk'], ['chalk-2','desk'],
    ['paper','ink'], ['code-text','code-bg'],
  ];
  for (const [fg,bg] of pairs) assert.ok(contrast(rgb(fg),rgb(bg)) >= 4.5, `${fg}/${bg}: ${contrast(rgb(fg),rgb(bg))}`);
  const soft = css.match(/--hl-soft:\s*rgba\(([^)]+)\)/)[1].split(',').map(Number);
  const softOnPaper = rgb('paper').map((value, i) => soft[i] * soft[3] + value * (1 - soft[3]));
  assert.ok(contrast(rgb('ink'), softOnPaper) >= 4.5);
  assert.ok(contrast([163,51,39],rgb('paper')) >= 4.5);
});

test('原文封面只作视觉截行，卡片链接与复制按钮分别接收交互', () => {
  const card = fs.readFileSync(new URL('../src/components/CaseCard.astro', import.meta.url), 'utf8');
  assert.ok(card.includes("Array.from(item.promptBlocks[0]?.raw ?? '').slice(0, 200).join('')"));
  assert.match(css, /\.card-media \.cover-excerpt\s*\{[^}]*white-space: pre-wrap[^}]*-webkit-line-clamp: 6/);
  assert.match(css, /\.card-detail-link::after\s*\{[^}]*position: absolute[^}]*inset: 0/);
});
