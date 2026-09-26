# 首批内容公开审核记录

日期：2026-09-26。审核人：建站 Agent（对照 Wiki 原文逐条核查）；**最终公开决定权在用户**。
本记录对应 `content/catalog.json` 的 `approvedForPublic` 字段，是公开构建门禁的依据。

## 审核标准

1. 提示词原文逐字核对（构建时端到端比对围栏字节，当前 20/20 一致）。
2. 媒体身份明确：实测成片 / 生成结果图 / 输入参考图 / 源资料示例图四类不混淆。
3. 实测状态准确：附成片 / 作者称已测试（本站未复测）/ 未见实测记录三种表述有原文依据。
4. 无第三方版权素材：不收录影视作品原名命名的素材页、不使用标注「仅供个人内部使用」或「未经许可禁止转载」的图像。
5. 未知模型、平台、时长不补写；页面不出现本机绝对路径。

## 案例审核（15 项）

| slug | 源文件 | 媒体 | 实测依据 | 结论 |
| --- | --- | --- | --- | --- |
| christmas-snow-chase | visual-prompt-system/案例-圣诞夜雪街追逐.md | 实测成片 mp4 + 输入参考图 2 张 | 源文标注 2026-09-16 实测验收通过，附成片 | ✅ 公开 |
| white-bg-outfit-spin | visual-prompt-system/案例-白底变装旋转.md | 实测成片 mp4 + 输入参考图 8 张 | 源文标注 2026-09-16 实测验收通过（效果与节奏俱佳） | ✅ 公开 |
| forty-three-sunsets | visual-prompt-system/案例-一天四十三次日落.md | 输入参考图 7 张，无成片 | 源文记录实测「勉强及格」及待改清单；未提供成片文件 → 「作者称已测试 · 未附成片」 | ✅ 公开 |
| restrained-micro-expression | visual-prompt-system/案例-克制微表情五段情绪递进.md | 无 | 源文标注志光 2026-09-20 提供并明确说明已验证 → 「作者称已测试」 | ✅ 公开 |
| tear-control-15s | ai-video/prompts/眼泪控制-…-用户实测提示词.md | 无 | 来源注记「称已测试」；未附平台/模型/成片 | ✅ 公开 |
| crying-monologue-15s | ai-video/prompts/哭戏独白-…-用户实测提示词.md | 无 | 同上 | ✅ 公开 |
| wuxia-blade-five-shot | ai-video/prompts/武打片-…-用户实测提示词.md | 无 | 同上 | ✅ 公开 |
| one-vs-six-parking | ai-video/prompts/以一敌六-…-用户实测提示词.md | 无 | 同上；原文未给总时长，页面不补写 | ✅ 公开 |
| cat-launch-28s | ai-video/prompts/小猫发布会-…-用户实测提示词.md | 无 | 同上；原文待核处（「本体：，」等）按原样保留 | ✅ 公开 |
| cool-walk-two-leads | ai-video/prompts/酷飒走路-…-用户实测提示词.md | 无 | 同上；镜头四两种机位描述并存按原文保留 | ✅ 公开 |
| father-daughter-hallway | ai-video/prompts/父女亲情-…-用户实测提示词.md | 无 | 同上 | ✅ 公开 |
| rain-alley-courier | ai-video/prompts/雨天小巷-…-用户实测提示词.md | 无 | 同上 | ✅ 公开 |
| image2-character-board | ai-video/prompts/👀图片-image2故事板玩法-9组.md「人物角色版」 | 源资料示例图 1 张 | 源文未附实测记录 → 标「附源资料示例图」，不作生成结果展示 | ✅ 公开 |
| image2-prop-board | 同上「道具概念图」 | 源资料示例图 1 张 | 同上 | ✅ 公开 |
| image2-fight-storyboard | 同上「故事版 / 打斗（给故事详情）」 | 源资料示例图 1 张 | 同上 | ✅ 公开 |

全部 15 项均为用户自产提示词与自产媒体，已逐条查看图像内容：三张 image2 示例图（人物设定板、
摩托车道具板、图书馆打斗故事板）均为 AI 生成图像，未识别出第三方版权素材；两段实测成片为
用户自制内容。未发现影视作品名称等同官方合作或原片素材的表述。

## 笔记审核（13 项）

| slug | 源文件 | 结论 |
| --- | --- | --- |
| video-prompt-structure | 模板-视频提示词总结构.md | ✅ 公开（纯文字方法） |
| fifteen-second-drama | 模板-十五秒短剧.md | ✅ 公开 |
| micro-expression-template | 模板-微表情特写.md | ✅ 公开 |
| fight-action-template | 模板-打斗动作.md | ✅ 公开 |
| multi-segment-discipline | 多段成片的分段纪律与连续性.md | ✅ 公开 |
| dialogue-punctuation | 台词标点与配音语气.md | ✅ 公开 |
| shot-breakdown-rules | 拆解分镜规则.md | ✅ 公开 |
| writing-rules | 写法规则库.md | ✅ 公开 |
| scene-variables | 场景变量库.md | ✅ 公开 |
| performance-variables | 表演变量库.md | ✅ 公开 |
| character-sheet-template | 模板-人物设定图.md | ✅ 公开 |
| char-scene-prop-structure | 模板-角色、场景、道具提示词总结构.md | ✅ 公开 |
| character-style-variables | 角色造型变量库.md | ⛔ **不公开**：其 Wiki 内链指向「👀图片-吉卜力幻想工业机械-8组」等转载受限图像资料；在逐项核对授权前不进入公开构建（preview 预览可见） |

## 明确排除的源材料（未建页面）

- `👀图片-学院百褶裙-*`、`👀图片-吉卜力幻想工业机械-*`：源文标注转载受限，不进入公开候选。
- 标题含影视作品名的提示词文件（如「二十五二十一」「继承者们」等）：逐项核对展示范围前不公开。
- `👀图片-场景-4类.md`、`👀图片-人物设定图-4类.md`：主要是含 `{{[占位符]}}` 的可填模板，按规则归入模板/方法，不冒充实测案例。

## 待用户决定

1. 站点正式名称：已确认「AI 提示词档案馆」（2026-09-26）。
2. 以上 ✅ 条目是否维持公开；⛔ 条目核对授权后可改判。
3. 公开发布时间与方式（本次交付仅本地预览与公开构建校验，未部署）。
