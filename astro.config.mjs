import { defineConfig } from 'astro/config';
import { satteri, satteriHeadingIdsPlugin } from '@astrojs/markdown-satteri';

export default defineConfig({
  output: 'static',
  markdown: {
    // 关闭智能标点：笔记正文渲染时不改写引号、破折号等原文字符。
    processor: satteri({
      features: { smartPunctuation: false },
      hastPlugins: [satteriHeadingIdsPlugin()],
      shikiConfig: { theme: 'vitesse-light' },
    }),
  },
});
