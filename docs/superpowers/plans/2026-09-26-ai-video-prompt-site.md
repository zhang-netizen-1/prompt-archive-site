# AI 图像与视频提示词案例网站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本目录建立面向公众的图像与视频提示词静态网站，使每个获准展示的完整案例拥有独立页面、原文复制、真实媒体预览和关联笔记阅读入口。

**Architecture:** Wiki 两个指定目录是只读来源。Node 导出脚本根据独立的网站编辑清单抽取提示词、转换 Obsidian 链接并复制获准媒体；Astro 使用导出的 JSON 和 Markdown 生成静态页面。公开构建只包含通过公开审核的条目，开发预览可展示待审核候选。

**Tech Stack:** Node.js 22.22.3、Astro 静态构建、TypeScript、Node 内置测试运行器、CSS。Astro 选型依据：[官方安装说明](https://docs.astro.build/en/install-and-setup/)、[内容集合说明](https://docs.astro.build/en/guides/content-collections/)、[静态动态路由说明](https://docs.astro.build/en/reference/errors/get-static-paths-required/)。安装时由 `package-lock.json` 锁定当时的稳定版本。

**视觉依据：** 用户已选 A「影像资料馆」、案例页方案 1「画面优先」、控件 A1「克制的档案控件」。实现前阅读 `docs/视觉设计规范.md`；缩小草图仅用于理解方向，不照搬字号。

---

## 执行边界

- 工作根目录：`/Users/zhiguang/Downloads/提示词网站`。规划阶段已按用户单独指令初始化本地 Git 仓库并提交规划文件；本实施计划不包含额外的提交、远程推送或公开部署，这些由后续明确指令决定。
- Wiki 根目录：`/Users/zhiguang/wiki`。导出流程只读，不修改 `library/`、`raw/` 或 Wiki 元数据。
- 本计划的可验收交付是本机可运行、可构建、可浏览的网站，以及可执行的公开构建校验。正式上线另行处理。
- 初版分设图像案例和视频案例入口。视频区分“有成片”“作者称已测试但未附成片”；图区分“有结果图”“只有参考图或文字”。不推断未知模型、时长或效果。

## 文件职责图

| 文件 | 单一职责 |
| --- | --- |
| `package.json`、`astro.config.mjs`、`tsconfig.json` | 项目命令与构建配置 |
| `content/catalog.json` | 网站编辑清单：稳定 slug、来源、分类、媒体与公开审核状态 |
| `scripts/lib/source.mjs` | 读取源文件、frontmatter 和原文片段 |
| `scripts/lib/wiki-links.mjs` | 解析 Obsidian 文档与媒体引用 |
| `scripts/lib/export.mjs` | 依据清单导出案例、笔记与获准媒体 |
| `scripts/export-wiki.mjs` | 导出命令入口、错误报告与退出码 |
| `src/generated/catalog.json` | 导出后的结构化页面数据，不手改 |
| `src/generated/notes/*.md` | 转换后的笔记正文，不手改 |
| `public/media/*` | 通过校验的本地媒体副本，不手改 |
| `src/lib/catalog.ts` | 页面查询、筛选和内容类型定义 |
| `src/layouts/SiteLayout.astro` | 全站文档骨架、导航与元信息 |
| `src/components/CaseCard.astro` | 列表卡片 |
| `src/components/MediaGallery.astro` | 成片、参考图与无媒体状态 |
| `src/components/PromptBlock.astro` | 原文展示与复制按钮 |
| `src/components/NotePreview.astro` | 案例页的关联笔记预览 |
| `src/pages/index.astro` | 首页精选与任务入口 |
| `src/pages/cases/index.astro` | 跨媒介的全站案例搜索 |
| `src/pages/images/index.astro`、`src/pages/videos/index.astro` | 图像与视频案例各自列表 |
| `src/pages/cases/[slug].astro` | 独立案例页 |
| `src/pages/collections/[slug].astro` | 合集页 |
| `src/pages/notes/index.astro`、`src/pages/notes/[slug].astro` | 笔记列表与阅读页 |
| `src/styles/global.css` | 视觉系统、排版、响应式样式 |
| `tests/*.test.mjs` | 原文、链接、媒体和发布门禁的关键行为测试 |

## Task 1：建立可运行的静态站点骨架

**Files:** Create `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/layouts/SiteLayout.astro`, `src/pages/index.astro`, `src/styles/global.css`, `.gitignore`.

- [ ] **Step 1:** 检查 `node -v`；要求不低于 Astro 官方当前安装文档给出的最低版本。本机核查为 `v22.22.3`。
- [ ] **Step 2:** 在现有目录手动安装 `astro`，设置 `dev`、`build`、`preview`、`test` 四条命令；`test` 使用 `node --test tests/*.test.mjs`。生成并保留 `package-lock.json`。
- [ ] **Step 3:** 设置 `output: 'static'`；建立共享布局与首页骨架，主导航地址固定为 `/images/`、`/videos/`、`/notes/`，全站搜索进入 `/cases/`。CSS 依据 `docs/视觉设计规范.md` 定义颜色、字体、间距和移动端断点。
- [ ] **Step 4:** 运行 `npm run build`。预期 `dist/index.html` 存在且 HTML 含图像、视频、笔记三个导航入口；用 `npm run dev` 验证首页可访问。

最小配置形状：

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
export default defineConfig({ output: 'static' });
```

## Task 2：从源 Markdown 精确抽取案例原文

**Files:** Create `content/catalog.json`, `scripts/lib/source.mjs`, `tests/source.test.mjs`; modify `package.json` dependencies/scripts.

- [ ] **Step 1:** 安装 `gray-matter`。在 `tests/fixtures/` 增加一份包含 frontmatter、说明、`## 提示词原文`、代码围栏和中文标点的最小 Markdown；测试抽取得到的提示词与围栏内原始字符逐字一致，尤其验证首尾换行与 `<!-- 标记 -->`。
- [ ] **Step 2:** 运行 `npm test`，先观察该测试因 `readSource` 未实现而失败。
- [ ] **Step 3:** 实现 `readSource(filePath)`，返回 `{ frontmatter, body, fencedBlocks, headings }`。围栏代码的 `raw` 用源字符串偏移切片获取，不通过 Markdown 重新序列化；同时记录起止行，供编辑清单精确引用。
- [ ] **Step 4:** 编辑清单每个案例明确写入 `slug`、`title`、`source`、`promptBlock` 或 `promptRange`、`medium: image|video`、`topic`、`tags`、`media`、`evidence`、`relatedNotes`、`relatedCases`、`approvedForPublic`。先录入“圣诞夜雪街追逐”“白底变装旋转”、至少一篇无成片视频案例，以及一组带效果图和完整提示词的图像案例，形成四类纵切。
- [ ] **Step 5:** 再运行 `npm test`，预期原文测试通过。任何找不到的 `promptBlock` 或越界范围须报错，不能静默产生空提示词。

编辑清单的稳定字段示例：

```json
{
  "slug": "christmas-snow-chase",
  "title": "圣诞夜雪街追逐",
  "source": "library/visual-prompt-system/案例-圣诞夜雪街追逐.md",
  "promptHeading": "提示词全文",
  "medium": "video",
  "topic": "叙事短片",
  "tags": ["追逐", "圣诞", "多镜头"],
  "evidence": "video-attached",
  "approvedForPublic": false
}
```

这里的 `approvedForPublic: false` 是真实的初始状态，待逐项审核后才可改为 `true`。

## Task 3：解析 Obsidian 引用并导出媒体与笔记

**Files:** Create `scripts/lib/wiki-links.mjs`, `scripts/lib/export.mjs`, `scripts/export-wiki.mjs`, `tests/wiki-links.test.mjs`, `tests/export.test.mjs`; modify `package.json`.

- [ ] **Step 1:** 测试四种引用：`[[模板-微表情特写]]`、`![[raw/assets/.../实测成片.mp4]]`、`![[02 (3).mov]]`、`![](../../../raw/assets/ai-video/示例.png)`。预期转成站内笔记地址或 `/media/` 地址；同名媒体多处匹配时明确报“歧义”，没有匹配时报“缺失”。
- [ ] **Step 2:** 运行 `npm test` 确认测试先失败。实现 Wiki 文件索引：普通 Markdown 相对图片先以源文件目录解析，Obsidian 媒体先以 Wiki 根目录相对路径解析，最后才按唯一文件名匹配；不得把 `/Users/...` 写入生成页面。
- [ ] **Step 3:** 导出脚本只处理清单引用的案例和笔记。复制媒体到 `public/media/`，文件名用稳定内容哈希加扩展名避免冲突；把 Markdown 中的 Obsidian 引用转换为公开可解析的链接，保留围栏内提示词原文不变。
- [ ] **Step 4:** 每次导出先清理上次生成的 `src/generated/` 与 `public/media/`，再为本次允许展示的案例写出结构化 JSON、为允许展示的笔记写出转换后的 Markdown。构建输出包含 `report.json`，列出未解析链接、缺失媒体、重复 slug、未审核条目；预览切换为公开模式时不能残留未审核媒体。
- [ ] **Step 5:** 把 `package.json` 的 `build` 命令更新为先运行 `export:wiki` 再运行 `astro build`；`export:wiki` 指向 `node scripts/export-wiki.mjs`，确保单独运行构建不会使用陈旧内容。
- [ ] **Step 6:** 运行 `npm test` 与 `npm run export:wiki`。预期四类纵切案例数据齐备；源 Wiki 的 `git status --short`（若 Wiki 是 Git 仓库）或导出前后文件哈希比较不变。

导出命令的接口：

```js
// scripts/export-wiki.mjs
import { exportWiki } from './lib/export.mjs';
const wikiRoot = process.env.WIKI_ROOT ?? '/Users/zhiguang/wiki';
const mode = process.env.SITE_MODE === 'public' ? 'public' : 'preview';
const report = await exportWiki({ wikiRoot, mode });
if (report.errors.length) process.exitCode = 1;
```

## Task 4：建立独立案例页与可信媒体展示

**Files:** Create `src/lib/catalog.ts`, `src/components/MediaGallery.astro`, `src/components/PromptBlock.astro`, `src/components/NotePreview.astro`, `src/pages/cases/[slug].astro`; modify `src/styles/global.css`.

- [ ] **Step 1:** 在 `catalog.ts` 定义案例媒介 `image|video`、媒体角色 `result|reference`、证据状态的类型和 `getCase(slug)`、`getAllCases()` 查询。非法媒介或 `evidence` 值必须在导出阶段拒绝。
- [ ] **Step 2:** 静态路由 `getStaticPaths()` 从导出的案例数组返回每个 `{ params: { slug }, props: { caseItem } }`，保证每个案例有唯一 URL。
- [ ] **Step 3:** 页面按已选定的“画面优先”单列布局，依次呈现“主题 → 标签 → 大幅结果媒体/参考图与附件 → 完整提示词 → 来源与结果 → 关联笔记 → 相关案例”。视频使用原生 `<video controls preload="metadata">`；图像结果和输入参考图分区并明确标注；无媒体则按媒介显示“暂无结果图”或“暂无成片”。
- [ ] **Step 4:** `PromptBlock` 把完整原文放入只读文本容器，默认不截断；复制按钮调用 `navigator.clipboard.writeText(rawPrompt)`；成功后在按钮附近显示“已复制完整提示词”，失败时允许用户手动选择原文。复制 payload 不包括标题、摘要和标签。图标、附件切换和反馈位置遵循 `docs/视觉设计规范.md`。
- [ ] **Step 5:** 用浏览器检查四类页面：有视频、图像有结果图、有参考图但无结果、纯文字。复制后粘贴到文本框，与导出 JSON 中的 `rawPrompt` 比较，预期完全相同。

动态页的必要路由形状：

```ts
export function getStaticPaths() {
  return getAllCases().map((caseItem) => ({
    params: { slug: caseItem.slug },
    props: { caseItem },
  }));
}
```

## Task 5：案例发现：首页、列表、合集

**Files:** Create `src/components/CaseCard.astro`, `src/pages/cases/index.astro`, `src/pages/images/index.astro`, `src/pages/videos/index.astro`, `src/pages/collections/[slug].astro`; modify `src/pages/index.astro`, `src/lib/catalog.ts`, `src/styles/global.css`.

- [ ] **Step 1:** 首页精选只显示实际清单中标为精选的案例。三个任务入口分别落到图像案例、视频案例、方法笔记的有效地址；跨媒介搜索另设入口。
- [ ] **Step 2:** `/images/` 与 `/videos/` 分别列出各自媒介的案例；`/cases/` 支持跨媒介标题、标签和提示词正文搜索。主题、结果媒体状态、已知模型筛选只使用真实存在的值。空结果显示清楚的重置入口。
- [ ] **Step 3:** 合集页由编辑清单显式关联 `collectionSlug`，列出完整的子案例页；一篇源文档有多组完整提示词时，每组都有独立 `slug`。表格取值不自动拆成案例。
- [ ] **Step 4:** 浏览器验收：从首页分别进入图像与视频案例、跨媒介搜索中文词、组合两个筛选、从合集进入子案例；地址栏刷新后仍保留静态页面。

客户端筛选只操作已生成的卡片，不向用户暴露本机文件路径：

```js
const matches = (item, query, topic) =>
  (!query || item.searchText.includes(query.toLocaleLowerCase('zh-CN'))) &&
  (!topic || item.topic === topic);
```

## Task 6：笔记阅读页与站内关联

**Files:** Create `src/content.config.ts`, `src/pages/notes/index.astro`, `src/pages/notes/[slug].astro`; modify `src/components/NotePreview.astro`, `content/catalog.json`.

- [ ] **Step 1:** 使用 Astro `glob()` loader 读取 `src/generated/notes/*.md`；导出文件名就是网站清单中定义的笔记稳定 slug，不能随标题变更。笔记清单记录 `slug`、`title`、`source`、`summary`、`approvedForPublic`。
- [ ] **Step 2:** 阅读页显示标题、用途摘要、目录与 Markdown 内容。核对表格、代码围栏、图片、视频和中文内链的呈现；关联笔记卡显示摘要及前几个目录标题。
- [ ] **Step 3:** 建立案例到笔记的显式关系：图像与视频案例页都能进入模板/变量笔记；混合媒介笔记可同时服务两类案例。笔记页可列出关联案例。无法解析的内链保留文字但在导出报告中记为错误，公开构建不得带错发布。
- [ ] **Step 4:** 在手机宽度与桌面宽度实际浏览长笔记，检查表格横向滚动、目录定位、媒体宽度和代码块可读性。

Astro 内容集合配置的必要形状：

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
const notes = defineCollection({ loader: glob({ pattern: '*.md', base: './src/generated/notes' }) });
export const collections = { notes };
```

## Task 7：公开内容门禁与第一批内容核查

**Files:** Modify `content/catalog.json`, `scripts/lib/export.mjs`, `src/pages/index.astro`; create `tests/public-build.test.mjs`, `docs/content-review.md`.

- [ ] **Step 1:** 测试 `SITE_MODE=public` 时只导出 `approvedForPublic: true` 的案例、笔记与媒体；未审核条目不能从路由或搜索索引访问。重复 slug、缺失源文、缺失已声明媒体时构建失败。
- [ ] **Step 2:** 逐项审阅第一批约 16–24 个候选案例，图像和视频均须有代表性；记录原文位置、媒体角色、用户反馈依据、素材来源和公开展示判断。先覆盖两篇有实测成片的视频案例、一组带结果图的完整图像提示词，再覆盖不同题材的纯文字案例。源笔记注明仅供内部使用或禁止转载的图像资料不能自动通过审核。
- [ ] **Step 3:** 只将审核通过的条目标记 `approvedForPublic: true`。未附生成结果的案例按媒介显示“暂无结果图”或“暂无成片”；任何仅有用户声明的实测稿必须显示“作者称已测试；本站未复测”。
- [ ] **Step 4:** 运行 `SITE_MODE=public npm run build`；预期报告零错误，`dist/` 中仅有获准公开的页面和媒体。抽查 HTML 不含 `/Users/zhiguang`、缺失媒体链接或未公开候选标题。
- [ ] **Step 5:** 运行本地预览，逐页核查首批案例的主题、标签、媒体、原文复制和笔记预览；记录最终验收结果。

公开门禁断言示例：

```js
import assert from 'node:assert/strict';
assert.equal(publicCases.every((item) => item.approvedForPublic === true), true);
assert.equal(new Set(publicCases.map((item) => item.slug)).size, publicCases.length);
```

## 计划自检

- 设计方案第 3–7 节对应 Task 4–6；第 5、8 节的原文和只读导出规则对应 Task 2–3、7；第 9 节验收标准分布于 Task 3–7。
- 页面与导出数据通过 `slug`、`medium`、`rawPrompt`、`evidence`、`relatedNotes`、`relatedCases` 连接；这些字段在 Task 2 的清单中定义，后续任务复用同名字段。
- 测试重点放在原文复制、链接/媒体解析、静态路由和公开门禁；视觉与交互通过真实浏览器检查。
