# 修复断链交互设计文档

日期: 2026-03-30

## 目标

修复 settings / article detail / post detail 三个页面共 13 个无功能按钮，使所有交互可用。

## 设计方案

### 1. settings.tsx（3处）

| 功能 | 方案 |
|------|------|
| 隐私协议 | 内嵌 ScrollView 展示静态隐私条款文本，通过 showModal 展示摘要或跳转新页面。考虑到 YAGNI，直接用 WebView 打开一个本地 HTML 或用 showModal 展示长文本即可 |
| 关于我们 | showModal 弹窗展示 App 名称、版本、简介、联系方式 |
| 清除缓存 | 调用 AsyncStorage.clear() 清空购物车缓存，expo-image Cache.clearAll()，显示成功提示 |

**设计决策**: 隐私协议和关于我们用 showModal 弹窗实现（KISS），无需新页面。清除缓存做真实清理。

### 2. article/[id].tsx（3处）

| 功能 | 方案 |
|------|------|
| 收藏/书签 | 本地 state 切换 + 视觉反馈（实心/空心图标），目前 articleStore 无持久化收藏，用组件内 state 即可（YAGNI） |
| 点赞 | 同上，本地 state toggle + 计数 +1/-1 |
| 分享 | 调用 RN Share API (`Share.share()`) 分享文章标题和链接文本 |

**设计决策**: 文章收藏/点赞不需要后端持久化（目前文章本身就是 mock 数据），本地 state 足够。

### 3. post/[id].tsx（7处）+ communityStore 扩展

#### communityStore 新增方法:
- `togglePostLike(postId)`: 切换帖子点赞，更新 mock 数据中的 likes 计数
- `addComment(postId, content)`: 添加评论到帖子，使用当前用户信息
- `toggleCommentLike(postId, commentId)`: 切换评论点赞

#### 按钮实现:
| 功能 | 方案 |
|------|------|
| 发送评论 | 调用 `addComment()`，清空输入框，键盘收起 |
| 点赞帖子 | 调用 `togglePostLike()`，图标/计数更新 |
| 评论点赞 | 调用 `toggleCommentLike()` |
| 收藏 | 本地 state toggle |
| 分享 | 调用 RN `Share.share()` |
| 三点菜单 | showModal 弹窗：举报 / 不感兴趣（展示 "感谢反馈" 提示） |

**设计决策**: 所有交互操作在 mock 数据上进行内存操作（Zustand store 更新），不写后端。与现有文章/社区的 mock 策略一致。

## 实施步骤

1. **communityStore.ts** — 添加 togglePostLike / addComment / toggleCommentLike 方法
2. **settings.tsx** — 实现隐私协议弹窗、关于我们弹窗、真实缓存清理
3. **article/[id].tsx** — 添加收藏/点赞/分享交互
4. **post/[id].tsx** — 接入 store 方法，实现全部 7 个交互

## 不做的事情（YAGNI）

- 不创建新页面（隐私协议/关于我们用弹窗）
- 不添加后端 API（社区数据仍为 mock）
- 不做评论回复功能（只做一级评论）
- 不做通知持久化（设置页的通知开关保持本地 state）
