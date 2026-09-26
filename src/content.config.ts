import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro:content';

// 导出的笔记文件名即编辑清单中的稳定 slug，不随标题变更。
const notes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/generated/notes' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    summary: z.string().default(''),
    category: z.string().default('笔记'),
    medium: z.enum(['image', 'video', 'mixed']).default('mixed'),
    sourceDisplay: z.string().default(''),
  }),
});

export const collections = { notes };
