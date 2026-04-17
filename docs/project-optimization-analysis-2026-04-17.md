# 李记茶 App 项目优化与功能扩展分析

> 生成时间：2026-04-17
> 关联前序文档：
> - `docs/project-optimization-analysis-2026-04-09.md`
> - `docs/project-optimization-roadmap-2026-04-09.md`
> - `docs/user-experience-audit.md`
> - `docs/20260404-fixed.md`

---

## 一、项目现状速览

**技术栈**：Expo 55 + RN 0.83 + React 19 + expo-router + NativeWind 4 + Zustand + Supabase（PG + Edge Functions + RLS）+ 原生模块（阿里一键登录、支付宝）。

**已完成业务模块**（路由 + store + migration 交叉验证）：

- **交易链路**：商品、购物车、结算、支付宝支付、订单、取消、物流追踪（实时订阅）
- **营销**：优惠券（含领券原子 RPC、范围限定）、会员积分、任务中心、邀请
- **内容**：文章/茶文化、社区 UGC（帖/故事/评论/点赞/收藏）
- **用户**：一键登录 + 密码、地址、收藏、我的帖子/评价
- **服务**：评价、站内通知、推送通知（新）、售后退款（新）
- **横切**：logger 脱敏、analytics 薄封装、20+ Edge Functions（含 `_shared` 抽象）、15 个测试文件

---

## 二、需要优化的地方

### P0 — 立即处理（交易/稳定性风险）

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| 1 | **新增模块（售后/推送）零测试覆盖** | `tests/` 无 afterSale / pushNotifications 测试 | 至少补幂等写入、鉴权失败、队列重试三条回归 |
| 2 | **Edge Function CORS 通配 `*`** | `supabase/functions/_shared/http.ts` | 生产环境按白名单收敛，区分 dev/prod |
| 3 | **`supabase` AppState 监听器未清理** | `removeSupabaseAppStateListener` 导出未调用 | 根布局 `_layout.tsx` 卸载时调用 |
| 4 | **新增 migration 尚未通过 RLS 审计** | `202604140005` / `202604140006` | 验证售后工单跨用户读写、push_device 跨用户读取 |

### P1 — 近期处理（架构债）

1. **`communityStore` 623 行、`checkout.tsx` 444 行** — 按 mapper / query / action 拆分（已有 roadmap 未落地）
2. **三处 `getFunctionErrorMessage` 重复定义** — 合并到 `supabaseFunction.ts`
3. **`couponStore` 仍用异步 `getSession()`** — 改为同步 `useUserStore.getState()` 与其他 store 对齐
4. **推送 token 注册缺离线重试** — App 冷启动失败后无自动补偿路径
5. **没有统一的请求去重 / TTL 规范** — roadmap 第三阶段至今未动

### P2 — 持续治理

1. **深色模式未系统化** — `Colors.ts` 只有 light，`expo-system-ui` 已安装但未联动
2. **无崩溃上报** — Sentry / expo-application 的 crashlytics 一个都没接
3. **analytics 是 logger 薄封装** — 数据无法落盘到后端分析表，建议新增 `analytics_events` 表 + 批量上报 Edge Function
4. **无 i18n** — `constants/copy.ts` 是硬编码中文字典，需为未来出海铺路
5. **CI/CD 不可见** — 无 `.github/workflows`，`npm run check` 未被强制
6. **图片未见 CDN / 懒加载策略** — `expo-image` 已装但无全局缓存策略

---

## 三、建议新增的功能模块

### P0（补齐电商基本盘）

| 模块 | 缺什么 | 价值 |
|---|---|---|
| **搜索增强** | 搜索历史当前内存假数据；无热词、无筛选排序、无拼音/同义词 | 商详转化入口，必做 |
| **优惠码 / 兑换码** | `cart.tsx:140` 仍提示"即将上线" | 与优惠券解耦的运营抓手 |
| **客服 / IM** | 完全空白，无在线咨询、无工单入口 | 售后/咨询流量必经路径 |
| **订单发票** | 未见任何发票字段 / 流程 | B 端客户硬需求 |

### P1（提升复购 / 留存）

| 模块 | 说明 |
|---|---|
| **定期购 / 订阅制** | 茶叶强复购品类，按月/按季自动下单 |
| **拼团 & 秒杀** | 复用现有 coupon + stock reservation 基础 |
| **分享裂变** | `share.ts` 仅有基础能力，缺邀请奖励闭环、H5 落地页 |
| **会员等级权益** | 积分/任务已就绪，但 `MemberBenefitsCard` 目前是静态展示 |
| **直播 / 短视频** | 茶行业内容属性强，可先做短视频（story 已有雏形） |
| **茶知识百科** | culture tab 目前内容单薄，可做茶品种/产地/冲泡法知识图谱 |

### P2（品牌力 / 差异化）

| 模块 | 说明 |
|---|---|
| **AR 识茶真功能** | `ar-scan.tsx` 目前是原型，接真实相机 + 模型服务 |
| **冲泡记录 / 日历** | 路由已有 `brewing-log.tsx`，打造"茶记"个人化资产 |
| **茶礼定制** | `gift.tsx` 可扩展到定制包装、刻字、配送预约 |
| **线下门店联动** | 门店查找、核销券、LBS 推荐 |
| **Web / 小程序端** | 复用 Supabase 后端，扩展分享落地与 SEO |
| **深色模式 + 无障碍** | 补 VoiceOver label、对比度检查 |

---

## 四、最优先三件事（本文档推荐的落地节奏）

1. **先把新增的"售后 + 推送"两个模块的测试和 RLS 补齐** — 它们刚进主干但零防护，风险最高。
2. **动手做第二轮 roadmap 的 P1 拆分（communityStore / checkout）** — 旧 roadmap 已经欠了两周，再堆新功能会越来越难。
3. **选一个"搜索增强 + 客服 IM"作为下一个业务增量** — 这两块是现有用户体验审计里最痛的缺口，投入产出比最高。

---

## 五、落地约束

- 遵循 KISS / YAGNI / SOLID，不追求大规模重构。
- 拆分优先按业务边界（mapper → query → action），而非按行数机械切分。
- 所有新增测试落到 `tests/` 下的 tsx runner，复用现有 `testHarness.ts`。
- 所有 RLS 改动必须附回归用例并在 `supabase/migrations/` 新增独立迁移，不修改历史迁移。
