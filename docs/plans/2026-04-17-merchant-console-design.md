# 李记茶 · 商家端（Merchant Console）设计稿

- 日期：2026-04-17
- 作者：协作产出（brainstorming）
- 状态：已与产品方确认关键决策，待进入 writing-plans 阶段
- 适用范围：本仓库 `liji-tea-app`，在现有 Expo RN + Supabase 架构上增量构建商家端

---

## 0. TL;DR

在现有 App 中为**品牌自营**团队（非多商家平台）提供一个"商家后台"，MVP 覆盖 **订单履约 / 售后处理 / 商品与库存管理** 三大模块。采用同一份 App、同一套 Supabase 账号、`user_roles` 表区分 `admin` / `staff` 两种角色；商家写操作全部走 `merchant_*()` RPC（`SECURITY DEFINER` + 角色校验 + 审计落库）。不侵入现有 C 端 Tabs 与组件，新增独立路由组 `src/app/merchant/*`。

遵循 KISS / YAGNI / SOLID：能砍则砍、能复用则复用、能集中则集中。

---

## 1. 关键决策（已锁定）

| # | 决策点 | 选择 | 理由 |
|---|---|---|---|
| 1 | 形态 | 同一 App + 角色切换 | 认证/推送/UI kit 全复用，体积与维护成本最低 |
| 2 | 定位 | 单品牌自营后台 | 无需 merchants 表、分账、多店铺体系 |
| 3 | MVP 范围 | 订单履约 + 售后 + 商品/库存 | 不做即无法运营的三件事；其它全部 V2 |
| 4 | 账号模型 | 同一 Supabase 账号 + `user_roles` 表 | 避免维护两套登录、会话、推送绑定 |
| 5 | 角色粒度 | `admin` / `staff` 两级 | 小团队够用，细化是 YAGNI |
| 6 | 入口形态 | "我的"页卡片 → `/merchant/*` 独立路由组 | 零侵入 C 端 Tab，权限守卫集中在 `_layout` |
| 7 | 页面策略 | 独立页面 + 按需复用原子组件 | 商家 UI 与顾客 UI 关注点不同，硬复用会耦合 |
| 8 | 后端通道 | Supabase RPC + `SECURITY DEFINER` | 与现有 `create_order` / `mark_order_paid` 模式一致；事务/审计一把梭 |
| 9 | 审计日志 | 一张 `merchant_audit_logs` 表 | 敏感动作必须可追溯；成本极低 |
| 10 | 线下核销 | **V2 延期** | 电商流程已够业务开跑 |

---

## 2. 系统架构总览

```
┌────────────────────────── 李记茶 App（单一二进制）──────────────────────────┐
│                                                                          │
│   顾客身份（默认）                        员工身份（role=admin/staff）     │
│   ┌─────────────────┐                   ┌─────────────────────────┐      │
│   │ (tabs)/         │                   │ (tabs)/profile          │      │
│   │  ├─ index       │                   │   └─ [商家后台入口卡片] │      │
│   │  ├─ shop        │    ────────▶     │           │             │      │
│   │  ├─ culture     │                   │           ▼             │      │
│   │  ├─ community   │                   │ /merchant/_layout       │◀─权限守卫
│   │  └─ profile     │                   │   ├─ orders             │      │
│   └─────────────────┘                   │   ├─ after-sale         │      │
│                                          │   └─ products           │      │
│                                          └────────────┬────────────┘      │
│                                                       │                   │
│                     userStore.role ──────────────────┘                   │
└──────────────────────────────────────────┬───────────────────────────────┘
                                           │
                      ┌────────────────────┼────────────────────┐
                      ▼                    ▼                    ▼
              Supabase Auth         Supabase RPC         merchant_audit_logs
              (共用账号体系)         merchant_*() 函数     (所有写操作留痕)
                                    SECURITY DEFINER
                                    + role 校验
```

**原则：**
- 同一 App、同一账号；`user_roles` 决定是否可进入后台
- 路由隔离：`src/app/merchant/*`，`_layout.tsx` 统一做权限守卫
- 写操作收口 RPC：角色校验 → 业务写入 → 审计落库，三步合一在一个事务
- 零侵入 C 端

---

## 3. 数据模型与 RLS 增量

### 3.1 新增表（2 张）

```sql
-- 一个用户一个角色（MVP 够用；多角色/权限矩阵是 V2）
create table public.user_roles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('admin','staff')),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id)
);

-- 商家写操作审计：每个 merchant_*() RPC 尾部统一落一条
create table public.merchant_audit_logs (
  id           bigserial primary key,
  actor_id     uuid not null references auth.users(id),
  actor_role   text not null,
  action       text not null,       -- ship_order | update_stock | approve_refund | ...
  target_type  text not null,       -- order | product | after_sale | user_role
  target_id    text not null,
  payload      jsonb,               -- 动作参数快照
  created_at   timestamptz not null default now()
);
create index on public.merchant_audit_logs (target_type, target_id, created_at desc);
create index on public.merchant_audit_logs (actor_id, created_at desc);
```

### 3.2 辅助判定函数

```sql
create or replace function public.is_merchant_staff()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin','staff')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;
```

### 3.3 现有表 RLS 增量（只放开 SELECT，写入全走 RPC）

| 表 | 增量策略 |
|---|---|
| `products` | `select using (is_merchant_staff() OR <原顾客策略>)` |
| `orders` / `order_items` | `select using (is_merchant_staff() OR user_id = auth.uid())` |
| `after_sale_requests` | 同上 |
| `merchant_audit_logs` | `select using (is_merchant_staff())` |
| `user_roles` | `select using (user_id = auth.uid() OR is_admin())`；INSERT/UPDATE 一律走 RPC |

### 3.4 MVP RPC 清单（9 个）

| RPC | 作用 | `action` 值 |
|---|---|---|
| `merchant_ship_order(order_id, carrier, tracking_no)` | 待发货 → 已发货，写 `shipments` | `ship_order` |
| `merchant_update_tracking(order_id, carrier, tracking_no)` | 修正单号/承运商 | `update_tracking` |
| `merchant_close_order(order_id, reason)` | 商家关闭订单 | `close_order` |
| `merchant_approve_refund(request_id, refund_amount, note)` | 同意退款 | `approve_refund` |
| `merchant_reject_refund(request_id, reason)` | 拒绝退款 | `reject_refund` |
| `merchant_mark_refund_completed(request_id, txn_id)` | 标记退款已打款 | `complete_refund` |
| `merchant_update_product(product_id, patch jsonb)` | 改价/描述/上下架 | `update_product` |
| `merchant_update_stock(product_id, delta, reason)` | 增减库存（delta 正负均可） | `update_stock` |
| `merchant_grant_role(user_id, role)` | 仅 admin：授予/撤销员工身份 | `grant_role` |

**统一 RPC 模板**：
```
1. is_merchant_staff() / is_admin() 校验，失败 → raise 'permission_denied'
2. 业务写入（事务内）；必要时加 state_conflict 校验
3. insert into merchant_audit_logs(actor_id, actor_role, action, target_type, target_id, payload)
```

---

## 4. 页面结构与交互

### 4.1 路由树

```
src/app/
├─ (tabs)/profile.tsx              # +「商家后台」卡片（仅 admin/staff 可见）
└─ merchant/
   ├─ _layout.tsx                  # 权限守卫 + 顶部 3-Tab
   ├─ index.tsx                    # V1 重定向到 orders；V2 做看板
   ├─ orders/
   │  ├─ index.tsx                 # 订单列表（默认筛"待发货"）
   │  └─ [id].tsx                  # 详情 + 发货/关闭
   ├─ after-sale/
   │  ├─ index.tsx                 # 售后列表（默认筛"待审核"）
   │  └─ [id].tsx                  # 详情 + 同意/拒绝/打款
   └─ products/
      ├─ index.tsx                 # 商品列表（含下架）
      └─ [id].tsx                  # 编辑与库存调整
```

### 4.2 权限守卫（`merchant/_layout.tsx` 伪代码）

```
未登录                      → redirect /login
已登录但 role ∉ {admin,staff} → redirect /(tabs) + toast '无权限'
通过                         → 渲染顶部三段式 Tab
```

### 4.3 模块要点

**订单履约**
- 列表筛选：全部 / 待发货 / 已发货 / 已完成 / 已取消
- 搜索：订单号 / 收件人手机
- 详情操作：`[发货]`（弹窗填承运商 + 单号）/ `[关闭订单]`
- 状态流转遵循 `pending → paid → shipping → delivered`；商家只触发 `paid → shipping`

**售后处理**
- 筛选：待审核 / 已同意 / 已拒绝 / 已完成
- 详情展示诉求、金额、图片凭证、关联商品
- 操作：`[同意退款]`（可调整金额）/ `[拒绝]`（必填理由）/ `[标记已打款]`（填 txn_id）
- 打款由运营线下完成，商家端只做状态流转与 txn_id 记录（对接支付宝退款 API 是 V2）

**商品/库存管理**
- 筛选：全部 / 已上架 / 已下架 / 低库存 (<10)
- 详情：
  - 价格 / 标题 / 描述 / 上下架开关 → `merchant_update_product`
  - 库存调整块："当前 X → [+/-] 输入 delta → 必填原因 → 提交" → `merchant_update_stock`
- **不做**：新建商品（含图片上传、SKU 配置）—— V2

### 4.4 视觉差异化

- 商家端用顶部 3-Tab（订单/售后/商品），与 C 端底部 5-Tab 视觉错开
- 配色收敛品牌色、字体用 Manrope（C 端正文用 Noto Serif），一眼区分
- 页面右上：员工头像 + 角色徽标（`admin` / `staff`）

### 4.5 状态管理

- 新增 `src/stores/merchantStore.ts`：`orders[]`、`afterSales[]`、`products[]` + 分页游标 + 筛选条件
- 写操作：乐观更新 → 调 RPC → 失败回滚（参考 `orderStore`）
- 复用现有 `supabaseClient`，不开新 client

---

## 5. 权限、错误处理、测试

### 5.1 安全分层

| 层 | 守卫 | 失败行为 |
|---|---|---|
| 路由层 | `_layout` 读 `userStore.role` | 跳回 `/(tabs)` + toast |
| UI 层 | 敏感按钮（授权/撤权）仅 admin 可见 | staff 看不到按钮 |
| RPC 层 | 函数首行 `is_merchant_staff()` / `is_admin()` | `raise 'permission_denied'` |
| 审计层 | RPC 尾部统一写 log | 失败则整个事务回滚 |

**防自提权**：`user_roles` 的 INSERT/UPDATE 一律通过 `merchant_grant_role()`；函数内 `is_admin()` 校验。

### 5.2 错误分类

| 场景 | 处理 |
|---|---|
| `permission_denied` | toast "无权限" + 日志 |
| `state_conflict`（重复发货等） | toast 具体原因 + 刷新列表 |
| 网络失败 | 回滚乐观更新 + "重试" |
| RLS 阻断（不应发生） | 兜底错误页 |

### 5.3 测试清单

- `merchantStore` 的筛选/分页/合并纯函数
- RPC 响应归一化（参考现有 `cancelOrderRpc` 测试风格）
- 权限工具 `canShipOrder(order, role)`、`canApproveRefund(req, role)`
- 不做：E2E、UI 快照（YAGNI）

---

## 6. 文件清单（供实施计划拆 task 用）

### 新增 SQL
- `supabase/migrations/2026MMDD0001_add_merchant_console.sql`
  - `user_roles`、`merchant_audit_logs` 建表
  - `is_merchant_staff()` / `is_admin()` helper
  - 9 个 `merchant_*()` RPC
  - 现有表 SELECT RLS 增量

### 新增前端
- `src/app/merchant/_layout.tsx`
- `src/app/merchant/orders/index.tsx`、`[id].tsx`
- `src/app/merchant/after-sale/index.tsx`、`[id].tsx`
- `src/app/merchant/products/index.tsx`、`[id].tsx`
- `src/stores/merchantStore.ts`
- `src/lib/merchantRpc.ts`（9 个 RPC 的 TS 封装）
- `src/components/merchant/*`（订单卡片、发货弹窗、库存调整面板等 5–8 个原子组件）

### 改动前端
- `src/app/(tabs)/profile.tsx` —— 条件渲染"商家后台"入口卡片
- `src/stores/userStore.ts` —— 登录/会话恢复时拉取 `user_roles` 存入 `role`
- `src/types/database.ts` —— 补两张新表类型

---

## 7. 工作量估算

| 模块 | 估时（人日） |
|---|---|
| SQL migration + 9 RPC + RLS | 1.5 |
| 权限守卫 + 入口 + userStore 改动 | 0.5 |
| 订单履约页（列表+详情+发货） | 1.5 |
| 售后处理页 | 1.0 |
| 商品/库存管理页 | 1.0 |
| merchantStore + RPC 封装 + 测试 | 1.0 |
| 视觉收尾 + 联调 | 0.5 |
| **合计** | **≈ 7 人日** |

---

## 8. V2 延期清单（明确不做）

- 线下门店扫码核销
- 社区 / 评论审核
- 优惠券 / 积分任务可视化配置
- 商家端推送发放（现有 push 系统会复用，但配置界面 V2 做）
- 数据看板（销售 / 转化 / 热销）
- 新建商品（图片上传、SKU 配置、多规格）
- 支付宝退款 API 自动打款
- 细粒度角色（ops / cs / warehouse）+ 权限矩阵

---

## 9. 下一步

本设计稿经产品方确认后，进入 `writing-plans` 阶段，按第 6 节文件清单拆成分步实施计划（预计按 SQL → RPC → store/lib → 路由守卫 → 三大模块页面 → 联调 的顺序推进）。
