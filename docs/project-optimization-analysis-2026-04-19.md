# 李记茶 App 项目优化分析（v4.4.0 合并后）

> 生成时间：2026-04-19
> 基线版本：`0cce13a` Merge `feat/merchant-ui-redesign`（v4.4.0 商家端 UI 重设计）
> 前序文档：
> - `docs/project-optimization-analysis-2026-04-17.md`（本次基准对照）
> - `docs/project-optimization-analysis-2026-04-09.md`
> - `docs/project-optimization-roadmap-2026-04-09.md`
> - `docs/rls-audit-2026-04-17.md`
> - `docs/user-experience-audit.md`

---

## 一、项目现状速览

**技术栈**：Expo 55 / React 19 / RN 0.83 + expo-router + NativeWind 4 + Zustand 5 + Supabase（PG + Edge Functions + RLS）+ 原生模块（阿里一键登录、支付宝）。

**代码体量**：
- `src/` 下 215 个 .ts/.tsx 文件，总计约 27,367 行。
- `supabase/migrations/` 45 份迁移；`supabase/functions/` 15 个 Edge Function。
- `tests/` 27 个测试文件（均为 tsx runner + 纯函数断言）。

**v4.4.0 新增**（本轮分析新纳入）：
- 商家端 15 个新组件（`src/components/merchant/*`，最大 145 行，粒度健康）。
- 商家端 7 个业务页（`src/app/merchant/*`，最大 321 行）。
- `MerchantColors.ts`、`merchantToastStore.ts`、`merchantStore.ts`（180 行）。
- 2 份 merchant migration：`202604170003_merchant_console_base.sql`（user_roles / audit_logs + RLS + 角色判定函数）、`202604170004_merchant_console_rpcs.sql`（9 个 merchant_\*() RPC）。

---

## 二、相对 04-17 分析已落地的改进 ✅

| # | 项 | 证据 |
|---|---|---|
| 1 | `communityStore` / `couponStore` / `userStore` 按 mapper/query/action 拆分 | `src/stores/communityStore.{posts,interactions,stories,types}.ts`、`couponStore.{actions,guards,types,cache}.ts` |
| 2 | `getFunctionErrorMessage` 三处重复已合一 | 仅存在于 `src/lib/supabaseFunction.ts` |
| 3 | Supabase AppState 监听器已接入根布局清理路径 | `setupSupabaseAutoRefresh()` 返回 cleanup，`src/app/_layout.tsx:303-307` 在 useEffect return 中调用 |
| 4 | 商家端新迁移默认启用 RLS + 审计 | `202604170003_merchant_console_base.sql` 引入 `is_merchant_staff()` / `is_admin()` + `user_roles` / `merchant_audit_logs` RLS |
| 5 | afterSale / pushNotifications 已有测试文件 | `tests/afterSale.test.ts` / `tests/pushNotifications.test.ts`（但见 P0-2） |
| 6 | Alert.alert 全量迁移 Toast + 弹窗圆角统一 | `77be385 refactor(merchant-ui)` 提交 |

---

## 三、仍未处理的旧债

### P0 — 立即处理

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 1 | **Edge Function CORS 仍为通配 `*`** | `supabase/functions/_shared/http.ts:3` `"Access-Control-Allow-Origin": "*"` | 改为 dev 白名单（`exp+liji-tea://`、本地 web）+ prod 白名单（正式 scheme / 公开 Web host）；从环境变量读取 |
| 2 | **afterSale / push 测试只覆盖纯函数** | `tests/afterSale.test.ts:32-60` 只测 `canApplyAfterSale` / 状态标签；`tests/pushNotifications.test.ts:11-60` 只测 payload 提取 | 补"幂等写入（重复 create-after-sale-request 返回同一 ticket）、鉴权失败（未登录 / 非本人订单）、队列重试（dispatch-push-queue 回退）"三条回归 |

### P1 — 近期处理

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 1 | **深色模式零进展** | `src/constants/Colors.ts` 仅 light；全项目 grep `useColorScheme`/`Appearance.getColorScheme` 零命中；`expo-system-ui` 已装但未联动 | 按 `{ light, dark }` 重构 Colors token；`_layout.tsx` 注入 ThemeProvider；settings.tsx 加主题切换 |
| 2 | **崩溃上报零接入** | 全项目 grep `Sentry` / `captureException` / `crashlytics` 零命中；`captureError` 只落本地 logger | 接入 `@sentry/react-native`（或 `expo-application` + 自建 `crash_reports` 表），把 `logger.captureError` 透传到远端 |
| 3 | **analytics 仍是 logger 薄封装** | 迁移列表无 `analytics_events` 表；`src/lib/analytics.ts` 应被重新审视 | 建 `analytics_events` 表 + 批量上报 Edge Function；客户端按 30s 或 20 条 flush |
| 4 | **推送 token 注册缺离线重试** | `usePushStore.bootstrap()` 在 `_layout.tsx:114` 调用，失败后无补偿；无 retry 队列 | 失败后写入 `pending_push_registration` 本地队列，网络恢复 / 下次冷启时重试 |
| 5 | **i18n 零基建** | `src/constants/copy.ts` 注释"便于多语言扩展"但无 i18n 库、无 locale key | 先引入 i18next-react-native 或 i18n-js；所有 copy 按 key 组织 |
| 6 | **CI/CD 缺失** | 无 `.github/workflows/`；`package.json:18 "check"` 未被任何 hook 强制 | 新建 `.github/workflows/check.yml` 跑 `npm run check`；PR 必须通过 |
| 7 | **单体巨石仍在 C 端**（商家端已克制） | `my-reviews.tsx` 693、`product/[id].tsx` 650、`coupons.tsx` 606、`community/create.tsx` 471、`checkout.tsx` 358 | 按 section 组件抽离（参考 `src/components/merchant/*` 的粒度） |
| 8 | **`orderStore.ts` 414、`communityStore.posts.ts` 409、`paymentFlow.ts` 403** 未拆 | 对应文件头几十行显示 action/query/mapper 混合 | `paymentFlow.ts` 按"预下单 / notify / 轮询 / 错误归一"拆 4 份；order/community store 按 mapper/query/action 继续细化 |

### P2 — 持续治理

- 图片无统一缓存/占位策略：`<Image>` 跨 15+ 文件使用，仅少数配 `transition=`，**无一处** `cachePolicy=` / `placeholder=`。
- Edge Functions 无 rate limit：`create-order` / `claim-coupon` / `register-push-device` 典型可刷接口未见限流。
- `merchant_audit_logs` 无 TTL / 归档策略，随订单线性膨胀。
- 图片未 CDN / 未压缩管控：assets 未见统一压缩流水线。

---

## 四、本轮新发现的优化点（v4.4.0 引入）

### 架构 / SOLID

1. **`MerchantColors.ts` 与 `Colors.ts` 双轨色板** — 违反 DRY；未来做 dark mode 需要同时维护两套。应合并为 `theme.ts`，按 `scope: 'customer' | 'merchant'` + `mode: 'light' | 'dark'` 四象限。
2. **`MerchantToast` 系统独立存在** — 根布局已有 `<TeaModal />`；商家端另搭了 `merchantToastStore` + `MerchantToast` 组件。C 端未来要 Toast 时会出现第三套。应把 Toast 提到全局（`src/components/ui/Toast.tsx` + `toastStore`）。
3. **商家端 detail 页即将膨胀**：`orders/[id].tsx` 321 / `after-sale/[id].tsx` 313 / `products/[id].tsx` 238。建议主动把 Bento 块抽成 `<OrderSummaryBlock />` / `<RefundTimelineBlock />` 等 section，避免下一轮需求超 400 行。

### 安全 / 健壮性

4. **`merchant_*()` RPC 9 个仅 4 个测试**（`merchantErrors` / `merchantFilters` / `merchantHeroStats` / `merchantToast`） — 缺事务失败回滚、审计写入、鉴权越权、库存锁竞争的回归用例。
5. **`user_roles` 表仅 admin/staff 两态** — migration 自注释"细粒度权限矩阵是 V2 的事"；若未来支持多商户需要预留迁移路径（增加 `merchant_id` 列）。

### 性能

6. **社区组件大量内联 `style={{ ... }}` + 硬编码尺寸**：`PostCard.tsx:71/104/165`、`StoryRow.tsx:28`、`SeasonalPicks.tsx:29`、`FeaturedArticle.tsx:9` 等；可抽 `<TeaImage />` 统一走 NativeWind + `cachePolicy` + `placeholder` + `transition`。
7. **首屏可能重复 fetch 相同接口**：`_layout.tsx:108-114` 集中预取 profile/addresses/favorites/coupons/push，但各 store 内部未必有请求去重/TTL；需要一次全局审计。

---

## 五、推荐落地节奏

### 第一梯队（两周内，ROI 最高）

1. **CORS 白名单化**（30 分钟，P0 安全）
2. **补 afterSale / push / merchantRpc 关键回归测试**（半天，P0 稳定性）
3. **`<TeaImage />` 封装 + 全项目替换**（半天，体验 + 一致性）
4. **接入 Sentry（或替代）+ `captureError` 透传远端**（半天，可观测性）

### 第二梯队（下一个 sprint）

- 主题系统统一 `Colors` + `MerchantColors` 并引入 dark 变体
- `paymentFlow.ts` / `my-reviews.tsx` / `product/[id].tsx` 按 section 拆
- 全局 `<Toast />` 统一（替换 `MerchantToast`）
- `.github/workflows/check.yml` 强制 `npm run check`

### 第三梯队（业务优先时延后）

- `analytics_events` 表 + 批量上报
- i18n 基建
- Edge Function rate limit
- `merchant_audit_logs` 归档策略

---

## 六、落地约束

- 遵循 KISS / YAGNI / SOLID：只做本梯队定义范围内的最小改动，不顺手重构。
- 所有新增 / 修改的 RLS 必须附 `tests/` 回归用例。
- 所有 migration 严格新增文件，不修改历史迁移。
- 依赖新增（Sentry 等）须先经用户批准再动 `package.json`。
- 所有代码注释与日志使用中文。
