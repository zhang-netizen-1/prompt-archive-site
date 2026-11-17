import { defineConfig } from 'astro/config';
import { satteri, satteriHeadingIdsPlugin } from '@astrojs/markdown-satteri';

export default defineConfig({
  output: 'static',
  build: {
    // 串行渲染页面：避免并行渲染向同一产物文件交错写入（曾致 /images/ 与
    // /videos/ 页面互相嵌入对方内容）。站点体量小，串行耗时可忽略。
    concurrency: 1,
  },
  markdown: {
    // 关闭智能标点：笔记正文渲染时不改写引号、破折号等原文字符。
    processor: satteri({
      features: { smartPunctuation: false },
      hastPlugins: [satteriHeadingIdsPlugin(), {
        name: 'table-scroll',
        element: {
          filter: ['table'],
          visit(node, ctx) {
            ctx.wrapNode(node, {
              type: 'element', tagName: 'div',
              properties: { className: ['table-scroll'] }, children: [],
            });
          },
        },
      }],
      shikiConfig: { theme: 'vitesse-light' },
    }),
  },
});
