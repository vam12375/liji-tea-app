# 社区改版实施计划

日期：2026-04-20

**Goal:** 基于现有 Expo Router + Zustand + Supabase 架构，把李记茶社区从“内容列表 + 基础互动”升级为“推荐 / 问答 / 冲泡”三主轴社区，并补齐搜索沉淀、商品挂卡和问题详情结构。

**Architecture:** 不重建社区底座，继续复用现有 `posts / post_comments / post_likes / post_bookmarks / stories / notifications` 体系；前端在现有 `src/app/(tabs)/community.tsx`、`community/create.tsx`、`post/[id].tsx` 基础上重组；必要时补增量字段和页面，不一次性推翻现有模型。

**参考文档：**

- `docs/superpowers/specs/2026-04-20-community-redesign-design.md`
- `docs/superpowers/specs/2026-04-20-community-page-blueprint.md`

**实施原则：**

- KISS：先完成“看得懂、搜得到、能转化”的主链路
- YAGNI：本轮不做关注关系、私信、直播、附近、短视频优先
- SOLID：页面、store、mapper、query、组件四层继续拆清楚，不把新逻辑全部塞回单页面

---

## Phase 0：约束与基线

### 目标

- 在正式改造前先明确本轮边界，避免中途范围失控

### 本轮要做

- 社区首页三主轴重构
- 问题详情页
- 社区搜索升级
- 内容详情挂商品
- 评论回复 UI
- 标签聚合页
- 社区收藏页

### 本轮不做

- 关注 / 粉丝
- 私信
- 直播 / 短视频播放器
- 推荐平台化
- 达人体系
- 同城活动

---

## Task 1：补社区域最小数据结构

**Files:**

- Modify: `src/types/database.ts`
- Modify: `src/lib/communityModels.ts`
- Modify: `src/stores/communityStore.types.ts`
- Create: `supabase/migrations/202604200001_expand_community_post_metadata.sql`

### 目标

- 给社区内容补最小必要字段，让前端能承载标签、商品挂卡、问题状态

### 建议新增字段

`posts`：

- `tea_category text`
- `scene_tags text[] not null default '{}'`
- `topic_tags text[] not null default '{}'`
- `product_ids uuid[] not null default '{}'`
- `equipment text`
- `taste_notes text[] not null default '{}'`
- `question_status text default 'open' check (question_status in ('open','resolved'))`
- `best_comment_id uuid null`

`post_comments`：

- 复用现有 `parent_id`
- 本轮不新增结构字段

### 说明

- 本轮不拆新表做复杂多对多关系，先用轻量字段支撑页面
- 若后续挂品逻辑变复杂，再把 `product_ids` 拆成关联表

### 输出结果

- 前端类型对齐
- mapper 能正确映射新字段
- 发帖页和详情页有数据承载位

---

## Task 2：重构社区首页为三主轴

**Files:**

- Modify: `src/app/(tabs)/community.tsx`
- Modify: `src/components/community/CommunityTabs.tsx`
- Modify: `src/components/community/PostCard.tsx`
- Create: `src/components/community/QuestionCard.tsx`
- Create: `src/components/community/BrewingRecordCard.tsx`
- Create: `src/components/community/CommunityTopicRail.tsx`
- Create: `src/components/community/CommunityHeader.tsx`

### 目标

- 把当前 `推荐 / 茶友 / 茶道 / 问答` 改成 `推荐 / 问答 / 冲泡`

### 实施步骤

1. 顶部 Header 重做

- 标题：社区
- 动作：搜索 / 收藏 / 发帖

2. 一级标签改造

- `推荐`
- `问答`
- `冲泡`

3. 推荐页内容重组

- Story Row
- 今日引导卡
- 话题滑条
- 混合推荐流

4. 问答页重组

- 提问 CTA
- 问题筛选条
- 问题列表

5. 冲泡页重组

- 记录 CTA
- 茶类筛选
- 冲泡记录列表

### 设计决策

- 官方内容不再作为一级 tab，而是进入推荐流卡片
- “茶友”不再作为一级导航，因为它是来源概念，不是用户任务

---

## Task 3：拆出问题详情页

**Files:**

- Create: `src/app/community/question/[id].tsx`
- Modify: `src/lib/routes.ts`
- Modify: `src/components/community/PostCard.tsx`
- Modify: `src/stores/communityStore.posts.ts`
- Modify: `src/lib/communityModels.ts`

### 目标

- 让提问帖不再完全复用普通帖子详情页

### 页面能力

- 问题头部
- 标签
- 已解决 / 待解答状态
- 最佳回答区占位
- 回答列表
- 相似问题
- 相关茶品

### 设计决策

- 本轮回答仍复用 `post_comments`
- “最佳回答”先支持字段与展示，不强制首期做完整管理流

---

## Task 4：增强内容详情页

**Files:**

- Modify: `src/app/post/[id].tsx`
- Modify: `src/stores/communityStore.interactions.ts`
- Modify: `src/stores/communityStore.posts.ts`
- Create: `src/components/community/PostRelatedProducts.tsx`
- Create: `src/components/community/CommentThread.tsx`

### 目标

- 给晒图动态和冲泡记录详情补转化区和评论回复结构

### 实施步骤

1. 详情页按类型渲染

- 晒图动态：图文 + 标签 + 商品卡
- 冲泡记录：参数 + 图片 + 风味 + 商品卡

2. 评论区升级

- 展示一级评论
- 支持展示回复层
- 保留评论点赞

3. 详情底部补“相关商品”

- 查看商品
- 加入购物车

### 设计决策

- 继续保留现有 `/post/[id]` 路由
- 评论回复先支持浏览和新增，不做复杂折叠层级

---

## Task 5：升级发帖页

**Files:**

- Modify: `src/app/community/create.tsx`
- Create: `src/components/community/create/ProductBindingPicker.tsx`
- Create: `src/components/community/create/TopicTagSelector.tsx`
- Create: `src/components/community/create/TeaCategoryPicker.tsx`

### 目标

- 把三类内容输入从“基本表单”升级成“可沉淀、可转化”的表单

### 新增输入项

晒图动态：

- 茶类
- 场景标签
- 关联商品

冲泡记录：

- 器具
- 风味标签
- 关联商品

提问帖：

- 问题标签
- 关联茶品

### 设计决策

- 首期标签选择器使用预设枚举 + 少量自由输入
- 不做复杂草稿系统

---

## Task 6：把搜索升级为社区多源搜索

**Files:**

- Modify: `src/app/search.tsx`
- Create: `src/stores/communitySearchStore.ts`
- Create: `src/lib/communitySearch.ts`
- Create: `src/components/search/SearchResultTabs.tsx`
- Create: `src/components/search/CommunitySearchResultCard.tsx`

### 目标

- 从“商品搜索”升级为“商品 + 内容 + 问答 + 冲泡”统一搜索

### 实施步骤

1. 搜索页头部保持不变

2. 增加结果分类标签

- 全部
- 商品
- 内容
- 问答
- 冲泡

3. 搜索历史继续保留

- 但记录真实搜索词，不再是固定假数据

4. 结果卡片按类型展示

- 商品结果 -> 商品详情
- 内容结果 -> 内容详情
- 问答结果 -> 问题详情

### 设计决策

- 首期允许服务端简单查询 + 前端二次筛选
- 不做复杂搜索排序策略

---

## Task 7：新增标签页与社区收藏页

**Files:**

- Create: `src/app/community/tag/[tag].tsx`
- Create: `src/app/community/saved.tsx`
- Modify: `src/lib/routes.ts`
- Modify: `src/stores/communityStore.interactions.ts`
- Modify: `src/stores/communityStore.posts.ts`

### 目标

- 把标签和收藏从装饰能力升级为回访入口

### 页面能力

标签页：

- 标签头部
- 内容筛选
- 内容列表

收藏页：

- 全部
- 内容
- 问答
- 冲泡

### 设计决策

- 复用现有 `post_bookmarks`
- 首期不做收藏夹分组

---

## Task 8：补首页与商品页的社区互通

**Files:**

- Modify: `src/app/product/[id].tsx`
- Modify: `src/components/home/CultureBanner.tsx`
- Modify: `src/components/home/SeasonalStory.tsx`
- Create: `src/components/product/ProductCommunitySection.tsx`

### 目标

- 让商品和社区互相导流，而不是各自独立

### 实施步骤

1. 商品详情页增加社区区块

- 茶友怎么泡
- 相关问答
- 真实晒图

2. 首页社区入口语义重做

- 从“去社区看看”升级成“看喝法 / 看评价 / 看问答”

### 设计决策

- 本轮只做内容聚合展示
- 不做商品页复杂社区编辑能力

---

## Task 9：治理入口最小落地

**Files:**

- Modify: `src/app/post/[id].tsx`
- Create: `supabase/migrations/202604200002_add_community_reports.sql`
- Create: `src/lib/communityReports.ts`

### 目标

- 把当前“感谢反馈”式举报变成真实落库

### 范围

- 举报帖子
- 举报评论
- 记录举报原因

### 说明

- 本轮只做前台举报落库
- 审核后台入口留给后续商家 / 运营台版本

---

## Task 10：代码结构收口

**Files:**

- Modify: `src/stores/communityStore.posts.ts`
- Modify: `src/stores/communityStore.interactions.ts`
- Create: `src/lib/communityQueries.ts`
- Create: `src/lib/communityQuestion.ts`

### 目标

- 避免社区改版后继续膨胀成巨型 store 和巨型页面

### 原则

- query 和 mapper 不继续塞在页面里
- 问答逻辑独立于通用帖子逻辑
- 搜索逻辑独立于产品搜索逻辑

---

## 建议实施顺序

1. Task 1：补数据结构
2. Task 2：社区首页三主轴
3. Task 3：问题详情页
4. Task 4：内容详情页增强
5. Task 5：发帖页升级
6. Task 6：社区搜索
7. Task 7：标签页与收藏页
8. Task 8：商品页互通
9. Task 9：举报落库
10. Task 10：结构收口

---

## 验收标准

### 体验层

- 用户能明确分辨“推荐 / 问答 / 冲泡”
- 用户能从社区内容自然跳到商品
- 用户能搜索到社区内容而不只搜到商品
- 用户能在问题详情页看到更清晰的回答结构

### 技术层

- 社区新字段类型完整对齐
- 新路由和现有路由不冲突
- `communityStore` 不继续无边界膨胀
- 数据查询逻辑尽量集中到 `lib` 层

---

## 本轮不执行的命令

- 不运行测试
- 不运行构建
- 不做数据库迁移执行

本文件只提供实施计划，不直接落代码。
