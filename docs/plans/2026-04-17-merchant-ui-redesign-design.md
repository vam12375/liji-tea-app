# 商家端 UI 重设计（Awwwards 风格重构）

- 日期：2026-04-17
- 状态：设计已与产品方确认，待进入 writing-plans 拆实施任务
- 范围：仅 `src/app/merchant/*`、`src/components/merchant/*`、商家端专属色板；不触碰 C 端、不触碰后端/RPC/RLS。
- 前置：v4.3.0 商家端 MVP 已上线；本次为 v4.4.0 的"视觉 + 布局重构"。

---

## 0. TL;DR

把当前商家后台从"品牌色 + chips + FlatList"升级为 **Editorial × Bento 混合**：用 Noto Serif SC 做衬线大标题与 hero 数字，每页顶部露出"三数字 / 四数字"全局态；详情页用 Bento 网格分区 + 底部 sticky 操作条；微动效（入场渐显 / 呼吸徽标 / count-up）补足"活"的感觉。Alert 全数改 Toast。

**工作量 ≈ 6 人日，零后端改动。**

参考：[awwwards.com](https://www.awwwards.com/) 的 Editorial 版面 + Bento 仪表盘两条线索。

---

## 1. 关键决策（已锁定）

| # | 决策点 | 选择 | 理由 |
|---|---|---|---|
| 1 | 设计基调 | Editorial（A）+ Bento（B）混合 | 贴合东方茶品牌气质；数据清晰可读 |
| 2 | 重做范围 | 视觉 + 布局重构（含 Bento 重排详情页） | 仅做 skin 收益太小；重做新页面超 MVP |
| 3 | 动效预算 | 入场 + 状态切换微动效 | 让数据"活"但不过度 |
| 4 | 筛选 chips | 保留填充 pill（视觉精细化） | 员工视觉习惯延续；下划线 tab 太轻 |
| 5 | 反馈机制 | Toast 替代 Alert.alert（破坏性动作保留 showConfirm） | Alert 打断率高 |
| 6 | 深色模式 | **不做** | 与 C 端断层；非本次目标 |
| 7 | Dashboard 页 | **不新增** | HeroStats 已分散承担全局态 |

---

## 2. 视觉语言（Design Tokens）

### 2.1 颜色增量（不推翻品牌色）

既有品牌色保留：
- `primary` `#435c3c`（主按钮 / 强调）
- `background` `#fef9f1`（页面底）
- `onSurface` `#1d1c17`（正文）

商家端新增（仅限 `/merchant/*`）：

```
ink-900     #0e1411   墨黑（大号数字 / 标题）
ink-500     #5a655c   石墨灰（副标）
paper       #faf6ee   宣纸（卡片底，比 background 更白一点）
line        #e6dfd1   米线（分隔线 / 描边）

语义状态色：
status-wait #a77432   琥珀（待发货 / 待审核）
status-go   #4d7a4f   茶青（进行中）
status-done #6b6b6b   墨灰（已完成 / 已结）
status-stop #a53b3b   朱砂（已拒绝 / 已取消）
```

落位：`src/constants/MerchantColors.ts`（新增文件，避免污染 `Colors.ts`）。

### 2.2 字体层次

```
display   Noto Serif SC  32/40pt 粗              页面大标题 + hero 数字
title     Manrope 700    16pt                    卡片标题
body      Manrope 500    14pt                    正文
meta      Manrope 500    11pt 0.08em tracking    标签 / 时间 / ID
num       Manrope 600    tabular-nums            所有数字（金额 / 单号 / 库存）
```

`Noto Serif SC` 只用在**页面 hero** 与**关键数字**；卡片内容仍用 Manrope，避免满屏衬线显得"不实用"。

### 2.3 间距 / 圆角 / 阴影

```
spacing    4 / 8 / 12 / 20 / 32                节奏刻意去掉 16
radius     card=20  pill=999  input=12
shadow     0 1 2 rgba(14,20,17,0.04) + 0 8 24 rgba(14,20,17,0.06)
border     1px #e6dfd1 取代大部分阴影
```

卡片改"纸白 + 1px 米线"，不再依赖阴影——像"纸片摊在茶桌上"。

---

## 3. 列表页新结构（以订单履约为例）

### 3.1 版面示意

```
┌─────────────────────────────────────────────┐
│  ← 商家后台                                 │  简化 AppHeader
├─────────────────────────────────────────────┤
│  订单 · 售后 · 商品 · 员工                  │  顶部 Tab（pill 保留，高度 28pt）
├─────────────────────────────────────────────┤
│                                             │
│   订单履约                           ⟳ 刷新 │  Noto Serif SC 32pt
│   ━━━━━━━━━━━                               │
│                                             │
│        3      18     5                      │  Hero 数字横排
│   待发货  进行中  已完成                    │  meta 11pt
│                                             │
│   ── 按状态 ─────────────────────           │
│   [ 待发货 ]  已发货  已完成  取消  全部    │  pill chips（未选中米线描边）
│                                             │
│   🔍  搜索订单号 / 收件人                   │  搜索独立一行
│                                             │
├─────────────────────────────────────────────┤
│  LJ-20260417-0003        待发货   ¥398.00  │  纸白底 + 1px 米线
│  下单 04-17 11:32                           │
│  收件 张先生 · 138****2345                  │
│  ————                                       │
│  龙井明前一号 × 1 · 铁观音传韵 × 2         │  新增：商品缩略 inline
├─────────────────────────────────────────────┤
│  LJ-20260417-0002        待发货   ¥128.00  │
│  ...                                        │
└─────────────────────────────────────────────┘
```

### 3.2 关键差异

| 要点 | 现状 | 新设计 |
|---|---|---|
| 页面标题 | AppHeader 一行 | 简 AppHeader + 页内衬线大标题 |
| Hero 数字 | 无 | 3 数字横排，秒读全局 |
| Chips | 填充 pill（仍保留） | 高度 28pt、未选中改米线描边 |
| 搜索 | 与 chips 挤一行 | 独立一行带 🔍 |
| 订单卡 | 灰底阴影 | 纸白 + 1px 米线 + 语义色徽标 |
| 订单内容 | 订单号/时间/金额 | 新增"商品缩略"一行 |

### 3.3 三大模块复用

- **售后列表**：Hero "待审核 12 · 已同意 3 · 已完成 8"
- **商品列表**：Hero "在架 47 · 下架 6 · 低库存 4"；低库存点可直达筛选

Hero 数字派生自 store 列表 reduce，零后端改动。

---

## 4. 详情页新结构（以订单详情为例）

### 4.1 Bento 版面示意

```
┌─────────────────────────────────────────────┐
│  ← 订单详情                                 │
├─────────────────────────────────────────────┤
│   LJ-20260417-0003                          │  meta 11pt
│   待发货                                    │  Noto Serif SC 28pt
│   ¥398.00                 04-17 11:32       │  大数字 + 右侧时间
├───────────────────────┬─────────────────────┤
│  收件                 │  物流                │  Bento 2 列
│  张先生               │  （未发货）          │
│  138****2345          │  ——                  │
│  北京市朝阳区...      │                      │
├───────────────────────┴─────────────────────┤
│  商品（2 件 · ¥398）                         │
│  ┌────┐ 龙井明前一号     × 1   ¥268         │
│  │img │ 铁观音传韵       × 2   ¥ 65         │
│  └────┘                                      │
├─────────────────────────────────────────────┤
│  时间线                                      │  新增状态历史
│  ● 11:32  下单                               │
│  ● 11:45  已支付                             │
│  ○ --     待发货                             │
├─────────────────────────────────────────────┤
│  [  关闭订单  ]   [    发货    ]             │  底部 sticky
└─────────────────────────────────────────────┘
```

### 4.2 关键差异

| 要点 | 现状 | 新设计 |
|---|---|---|
| 头部身份段 | 无 | 订单号（meta）+ 状态（衬线大字）+ 金额/时间 |
| 信息组织 | 平铺 7 段 | Bento 四块 |
| 商品展示 | 纯文本 | 缩略图 60×60 + 名称 + 数量 + 小计 |
| 时间线 | 无 | 下单 / 已支付 / 发货 / 送达，已完成 ● 未到 ○ |
| 操作条 | ScrollView 底部 | 底部 sticky（SafeAreaView inset） |
| 状态排版 | 小字 `paid` | 衬线大字"待发货" |

时间线字段复用 `orders.created_at / paid_at / shipped_at / delivered_at`，已有。

### 4.3 套用规则

- **售后详情**：身份段 "申请 ID / 状态 / 诉求金额"；Bento "原因+凭证 / 订单关联 / 商家备注"；sticky 同意/拒绝/打款
- **商品详情**：身份段 "商品名 / 状态徽章 / 当前库存大数字"；Bento "基本信息 / 库存调整"；sticky 保存

---

## 5. 微动效与交互

**原则**：员工每天看几百次，动效要**轻、快、少**。

### 5.1 入场

- 列表项 `FadeInDown` 40ms stagger，总时长 ≤ 240ms（只对前 6 项生效）
- 详情 Bento 块 60ms stagger，身份段 → 收件物流 → 商品 → 时间线

### 5.2 状态反馈

| 交互 | 动效 |
|---|---|
| Chips 切换 | 背景色 200ms ease |
| 按钮按压 | scale 0.98，100ms in / 150ms out |
| 卡片点击 | 背景色轻淡 120ms，松手恢复 |
| Hero 数字变化 | count-up 300ms，强化"实时" |
| 待办徽标 | 呼吸 opacity 0.7↔1，2 秒一次（只限 `待发货` / `待审核`） |
| 下拉刷新 | 保留 RN RefreshControl |

### 5.3 Toast 系统（替代 Alert.alert）

现状 `Alert.alert()` 打断操作流。新增顶部 Toast：

```
┌──────────────────────────────────┐
│  ✓  发货成功   LJ-20260417-0003  │  顶部滑入，3s 自动消失
└──────────────────────────────────┘
```

- 成功 = `status-go`
- 失败 = `status-stop`，点"查看"看详情
- **破坏性操作（关闭订单 / 撤销员工）保留 `showConfirm`**，防误操作

落位：
- `src/components/merchant/MerchantToast.tsx`
- `src/stores/merchantToastStore.ts`

### 5.4 不做

- ❌ 视差 / 跟随鼠标 / 粒子 / liquid —— 移动端无意义或掉帧
- ❌ 骨架屏 —— 数据量小，`ScreenState` 足够

---

## 6. 组件清单

### 6.1 新增（5 个）

```
src/components/merchant/
├─ MerchantScreenHeader.tsx   页面衬线大标题 + 可选右上角操作
├─ MerchantHeroStats.tsx      N 个大号数字横排（2~4 自适应）
├─ MerchantStatusBadge.tsx    统一徽标（琥珀/茶青/墨灰/朱砂 + 呼吸选项）
├─ MerchantBentoBlock.tsx     详情页 Bento 容器（标题 + slot）
├─ MerchantTimeline.tsx       详情页状态时间线
└─ MerchantStickyActions.tsx  详情页底部 sticky 操作条
```

### 6.2 改造（7 个，保留文件位置）

| 文件 | 改造点 |
|---|---|
| `MerchantTopTabs.tsx` | pill 高度 28pt、未选中米线描边 |
| `MerchantOrderCard.tsx` | 纸白 + 1px 米线 + 商品缩略行 |
| `MerchantAfterSaleCard.tsx` | 同上风格 + `MerchantStatusBadge` |
| `MerchantProductCard.tsx` | 同上 + 低库存用琥珀徽标 |
| `MerchantOrderFilterBar.tsx` | 搜索独立行 + 轻 chips |
| `MerchantEntryCard.tsx` | **不改** |
| `ShipOrderDialog.tsx` / `AfterSaleActionSheet.tsx` | 输入圆角 12 + 字号调整 |

### 6.3 基础设施新增（2 个）

```
src/constants/MerchantColors.ts           商家端色板
src/components/merchant/MerchantToast.tsx 顶部 Toast
src/stores/merchantToastStore.ts          Toast 状态
```

### 6.4 页面重排（7 个，仅 JSX / 样式）

```
src/app/merchant/
├─ orders/index.tsx        ScreenHeader + HeroStats + 新卡片
├─ orders/[id].tsx         Bento + Timeline + StickyActions
├─ after-sale/index.tsx    ScreenHeader + HeroStats
├─ after-sale/[id].tsx     Bento + StickyActions
├─ products/index.tsx      HeroStats（低库存可点筛）
├─ products/[id].tsx       Bento 两块 + StickyActions
└─ staff.tsx               单卡片 + 输入圆角统一
```

---

## 7. 工作量与风险

### 7.1 工作量（人日）

| 子任务 | 估时 |
|---|---|
| Design tokens（MerchantColors + 字体类名） | 0.25 |
| 5 个新组件 | 1.5 |
| Toast 系统（store + 组件 + 挂根） | 0.5 |
| 7 个卡片/筛选组件改造 | 0.75 |
| 7 个页面重排 | 2.0 |
| Reanimated 入场 + 呼吸 + count-up | 0.5 |
| 视觉回归走查（全流程一遍） | 0.5 |
| **合计** | **≈ 6 人日** |

### 7.2 风险与应对

| 风险 | 应对 |
|---|---|
| Noto Serif SC 在 Android 加载慢 | 已由 `_layout.tsx` 预加载；复用同一 font hook |
| Reanimated 入场叠加 FlatList 性能 | 仅对前 6 项启用；`getItemLayout` + `keyExtractor` 已到位 |
| 呼吸徽标耗电 | 只 2 种状态跑；`Animated.loop` + useNativeDriver |
| Toast 与 Alert 并存混淆 | 规则明确：非破坏性用 Toast；破坏性用 `showConfirm`；Alert 系统弹窗全废弃 |

### 7.3 YAGNI 清单（本次明确不做）

- Dashboard 首页（HeroStats 已分担）
- 新建商品 / 图片上传 / SKU 多规格
- 图表（销售曲线 / 转化漏斗）
- 深色模式
- 国际化 / 无障碍增强（后续独立专题）

---

## 8. 下一步

本稿与产品方确认后，进入 `writing-plans` 阶段：
1. 先落地 `MerchantColors` + 5 个新组件 + Toast 系统（无业务依赖）
2. 再按 `订单 → 售后 → 商品 → 员工` 顺序逐模块重排页面
3. 每完成一模块即 `npm run check` + 真机视觉回归
4. 全部完成后打 tag `v4.4.0`

参考源：[awwwards.com](https://www.awwwards.com/) Editorial 版面与 Bento 仪表盘两条主线。




