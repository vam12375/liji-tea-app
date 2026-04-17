# 李记茶 · 商家端（Merchant Console）MVP 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有 Expo RN + Supabase 架构内，为"李记茶"品牌自营团队交付商家后台 MVP：订单履约、售后处理、商品与库存管理三大模块，不侵入 C 端导航。

**Architecture:** 同一 App + 同一 Supabase 账号 + `user_roles` 表区分 `admin`/`staff`；新增 `src/app/merchant/*` 独立路由组与 `_layout` 权限守卫；写操作全部走 `merchant_*()` RPC（`SECURITY DEFINER` + 角色校验 + 审计落库）；新增两张表 `user_roles` / `merchant_audit_logs`，现有表仅加 SELECT RLS 增量。

**Tech Stack:** Expo 55 · React Native 0.83 · TypeScript 5.9 · Zustand · Supabase（Auth / Postgres / RLS / RPC）· NativeWind 5。

**参考设计稿：** `docs/plans/2026-04-17-merchant-console-design.md`

**共用命名约定：**
- Migration 文件：`supabase/migrations/2026MMDDNNNN_<slug>.sql`（NNNN 自增 4 位）
- RPC 命名：`merchant_<动词>_<对象>`，参数以 `p_` 前缀
- 前端路由组：`src/app/merchant/<模块>/...`
- 组件目录：`src/components/merchant/*`
- 测试文件：`tests/<slug>.test.ts`，挂到 `tests/run-tests.ts` 尾部

**统一提交前自检：** 每个 Task 结束都要跑 `npm run check`（lint + typecheck + test），通过才 commit。

---

## Task 1：建表、辅助函数与现有表 SELECT RLS 增量

**Files:**
- Create: `supabase/migrations/2026MMDD0001_merchant_console_base.sql`（文件名中 `MMDD` 用当天日期，首次写入用 `04180001`；如当天已存在同名前缀则递增末 4 位）

**目标：** 一次落地 `user_roles` / `merchant_audit_logs` 两张表、两个角色判定函数、以及现有 `products` / `orders` / `order_items` / `after_sale_requests` 的 SELECT RLS 增量。不含业务 RPC（那放 Task 2）。

**Step 1：确认现有表名与主键**

Run:
```bash
grep -n "create table" supabase/migrations/*.sql | grep -Ei "products|orders|order_items|after_sale_requests"
```
Expected: 能看到 `public.products`、`public.orders`、`public.order_items`、`public.after_sale_requests` 的建表位置；记下主键列（通常都是 `id uuid`）。若表名不同，以实际为准调整本 Task 后续 SQL。

**Step 2：写 migration 文件**

内容（完整照抄，只替换文件名日期）：

```sql
-- 商家端基础迁移：角色表 + 审计表 + 角色判定函数 + 现有表 SELECT RLS 增量
-- 业务 RPC 见后续迁移（merchant_console_rpcs）。

-- 1. 角色表：一个用户一个角色，MVP 范围内够用
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','staff')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

comment on table public.user_roles is '商家端员工角色表：仅标记 admin/staff，未登记视为普通顾客。';

-- 2. 审计表：所有 merchant_*() RPC 尾部统一落一条
create table if not exists public.merchant_audit_logs (
  id          bigserial primary key,
  actor_id    uuid not null references auth.users(id),
  actor_role  text not null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists merchant_audit_logs_target_idx
  on public.merchant_audit_logs (target_type, target_id, created_at desc);
create index if not exists merchant_audit_logs_actor_idx
  on public.merchant_audit_logs (actor_id, created_at desc);

comment on table public.merchant_audit_logs is '商家写操作审计：每个 merchant_*() RPC 在事务末尾写一条。';

-- 3. 角色判定函数（stable + security definer，供 RLS 策略与业务 RPC 共用）
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

comment on function public.is_merchant_staff() is '当前登录用户是否为 admin 或 staff。';
comment on function public.is_admin() is '当前登录用户是否为 admin。';

-- 4. 两张新表的 RLS
alter table public.user_roles enable row level security;
alter table public.merchant_audit_logs enable row level security;

-- 角色表：本人可看自己那行；admin 可看全部；写入全部拒绝（只能走 RPC）
drop policy if exists user_roles_select_self_or_admin on public.user_roles;
create policy user_roles_select_self_or_admin on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

-- 审计表：仅员工可读，禁止任何客户端直接写入
drop policy if exists merchant_audit_logs_select_staff on public.merchant_audit_logs;
create policy merchant_audit_logs_select_staff on public.merchant_audit_logs
  for select using (public.is_merchant_staff());

-- 5. 现有表 SELECT RLS 增量：放开员工读全量
-- 注：这里用 additive policy 方式新增一条，不修改原顾客策略，避免回归

drop policy if exists products_select_merchant on public.products;
create policy products_select_merchant on public.products
  for select using (public.is_merchant_staff());

drop policy if exists orders_select_merchant on public.orders;
create policy orders_select_merchant on public.orders
  for select using (public.is_merchant_staff());

drop policy if exists order_items_select_merchant on public.order_items;
create policy order_items_select_merchant on public.order_items
  for select using (public.is_merchant_staff());

drop policy if exists after_sale_requests_select_merchant on public.after_sale_requests;
create policy after_sale_requests_select_merchant on public.after_sale_requests
  for select using (public.is_merchant_staff());
```

**Step 3：本地/远程执行 migration**

Run（参考项目现有习惯）：
```bash
# 若使用 supabase CLI 本地开发库
supabase db push
```
Expected: 无错误；`user_roles`、`merchant_audit_logs` 出现在库中，`products/orders/...` 的 policies 多出一条 `*_select_merchant`。

**Step 4：手工冒烟验证**

用 SQL 控制台：
```sql
-- 1) 无任何角色时
select public.is_merchant_staff();  -- 期望 false
select public.is_admin();            -- 期望 false

-- 2) 插一条 admin 试试（模拟 seed；正式环境只能通过 Task 2 的 RPC 授予）
insert into public.user_roles(user_id, role) values ('<某真实 auth.users id>', 'admin');

-- 3) 切换到该用户会话后
select public.is_merchant_staff();  -- 期望 true
select public.is_admin();            -- 期望 true
select count(*) from public.orders;  -- 期望能读到全量订单
```

**Step 5：提交**

```bash
git add supabase/migrations/2026MMDD0001_merchant_console_base.sql
git commit -m "feat(merchant): 新增 user_roles / audit 表与角色判定函数

背景：商家端 MVP 需要角色体系与审计基础设施，见
docs/plans/2026-04-17-merchant-console-design.md §3。本次迁移只落基础
表与 RLS 增量，业务 RPC 见后续迁移。

改动：
- user_roles(user_id, role, created_at, created_by)：一个用户一角色，
  MVP 仅 admin / staff 两级。
- merchant_audit_logs：所有 merchant_*() RPC 事务末尾统一写一条；双索引
  覆盖按 target 查与按 actor 查两种常见审计诉求。
- is_merchant_staff() / is_admin()：stable + security definer，
  同时供 RLS 策略与后续业务 RPC 共用。
- 现有 products / orders / order_items / after_sale_requests 新增一条
  *_select_merchant policy，只放开员工读全量，不动既有顾客策略。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2：9 个 `merchant_*()` 业务 RPC

**Files:**
- Create: `supabase/migrations/2026MMDD0002_merchant_console_rpcs.sql`

**目标：** 把设计稿 §3.4 的 9 个 RPC 一次性交付；每个函数都遵循"校验 → 业务 → 审计"三段式模板，任一步失败整个事务回滚。

**Step 1：确认相关字段存在**

Run:
```bash
grep -nE "tracking_no|carrier|shipping_status|refund_amount|stock|is_active|status" src/types/database.ts | head -40
```
Expected: 能看到 `orders.status`、`orders.tracking_no` / `orders.carrier`（若无则本 Task SQL 需按实际列名调整）、`products.stock`、`products.is_active` / `products.status`、`after_sale_requests.status` / `after_sale_requests.refund_amount`。如字段名不同，以数据库实际为准。

> 如果 orders 没有 `carrier` / `tracking_no` 字段，先在本 migration 头部 `alter table public.orders add column if not exists carrier text, add column if not exists tracking_no text;` 补齐再继续。

**Step 2：写 migration**

内容：

```sql
-- 商家端业务 RPC：9 个 merchant_*() 函数
-- 统一模板：
--   1) 权限校验（is_merchant_staff / is_admin），失败 → raise exception 'permission_denied'
--   2) 状态校验（可选），失败 → raise exception 'state_conflict: <原因>'
--   3) 业务写入
--   4) insert into merchant_audit_logs

-- 审计写入工具函数：集中收口，避免每个 RPC 重复组装
create or replace function public._merchant_write_audit(
  p_action      text,
  p_target_type text,
  p_target_id   text,
  p_payload     jsonb
) returns void language plpgsql security definer as $$
declare
  v_role text;
begin
  select role into v_role from public.user_roles where user_id = auth.uid();
  if v_role is null then
    v_role := 'unknown';
  end if;

  insert into public.merchant_audit_logs(actor_id, actor_role, action, target_type, target_id, payload)
  values (auth.uid(), v_role, p_action, p_target_type, p_target_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- ========== 订单履约 ==========

create or replace function public.merchant_ship_order(
  p_order_id    uuid,
  p_carrier     text,
  p_tracking_no text
) returns public.orders language plpgsql security definer as $$
declare
  v_order public.orders;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if coalesce(btrim(p_carrier), '') = '' or coalesce(btrim(p_tracking_no), '') = '' then
    raise exception 'invalid_input: carrier/tracking_no required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'not_found: order';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'state_conflict: order status must be paid, got %', v_order.status;
  end if;

  update public.orders
    set status = 'shipping',
        carrier = p_carrier,
        tracking_no = p_tracking_no,
        updated_at = now()
    where id = p_order_id
    returning * into v_order;

  perform public._merchant_write_audit(
    'ship_order', 'order', p_order_id::text,
    jsonb_build_object('carrier', p_carrier, 'tracking_no', p_tracking_no)
  );

  return v_order;
end;
$$;

create or replace function public.merchant_update_tracking(
  p_order_id    uuid,
  p_carrier     text,
  p_tracking_no text
) returns public.orders language plpgsql security definer as $$
declare
  v_order public.orders;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  update public.orders
    set carrier = coalesce(nullif(btrim(p_carrier), ''), carrier),
        tracking_no = coalesce(nullif(btrim(p_tracking_no), ''), tracking_no),
        updated_at = now()
    where id = p_order_id
    returning * into v_order;
  if not found then
    raise exception 'not_found: order';
  end if;

  perform public._merchant_write_audit(
    'update_tracking', 'order', p_order_id::text,
    jsonb_build_object('carrier', p_carrier, 'tracking_no', p_tracking_no)
  );

  return v_order;
end;
$$;

create or replace function public.merchant_close_order(
  p_order_id uuid,
  p_reason   text
) returns public.orders language plpgsql security definer as $$
declare
  v_order public.orders;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'not_found: order';
  end if;
  if v_order.status in ('delivered','cancelled') then
    raise exception 'state_conflict: order already terminal (%).', v_order.status;
  end if;

  update public.orders
    set status = 'cancelled', updated_at = now()
    where id = p_order_id
    returning * into v_order;

  perform public._merchant_write_audit(
    'close_order', 'order', p_order_id::text,
    jsonb_build_object('reason', p_reason, 'from_status', v_order.status)
  );

  return v_order;
end;
$$;

-- ========== 售后 ==========

create or replace function public.merchant_approve_refund(
  p_request_id    uuid,
  p_refund_amount numeric,
  p_note          text
) returns public.after_sale_requests language plpgsql security definer as $$
declare
  v_req public.after_sale_requests;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_refund_amount is null or p_refund_amount <= 0 then
    raise exception 'invalid_input: refund_amount must be > 0';
  end if;

  select * into v_req from public.after_sale_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found: after_sale_request';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'state_conflict: request must be pending, got %', v_req.status;
  end if;

  update public.after_sale_requests
    set status = 'approved',
        refund_amount = p_refund_amount,
        merchant_note = p_note,
        updated_at = now()
    where id = p_request_id
    returning * into v_req;

  perform public._merchant_write_audit(
    'approve_refund', 'after_sale', p_request_id::text,
    jsonb_build_object('refund_amount', p_refund_amount, 'note', p_note)
  );

  return v_req;
end;
$$;

create or replace function public.merchant_reject_refund(
  p_request_id uuid,
  p_reason     text
) returns public.after_sale_requests language plpgsql security definer as $$
declare
  v_req public.after_sale_requests;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'invalid_input: reason required';
  end if;

  update public.after_sale_requests
    set status = 'rejected',
        reject_reason = p_reason,
        updated_at = now()
    where id = p_request_id and status = 'pending'
    returning * into v_req;
  if not found then
    raise exception 'state_conflict: request not pending or not found';
  end if;

  perform public._merchant_write_audit(
    'reject_refund', 'after_sale', p_request_id::text,
    jsonb_build_object('reason', p_reason)
  );

  return v_req;
end;
$$;

create or replace function public.merchant_mark_refund_completed(
  p_request_id uuid,
  p_txn_id     text
) returns public.after_sale_requests language plpgsql security definer as $$
declare
  v_req public.after_sale_requests;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if coalesce(btrim(p_txn_id), '') = '' then
    raise exception 'invalid_input: txn_id required';
  end if;

  update public.after_sale_requests
    set status = 'completed',
        refund_txn_id = p_txn_id,
        completed_at = now(),
        updated_at = now()
    where id = p_request_id and status = 'approved'
    returning * into v_req;
  if not found then
    raise exception 'state_conflict: request not approved or not found';
  end if;

  perform public._merchant_write_audit(
    'complete_refund', 'after_sale', p_request_id::text,
    jsonb_build_object('txn_id', p_txn_id)
  );

  return v_req;
end;
$$;

-- ========== 商品 / 库存 ==========

-- patch 只允许白名单字段，避免员工误/恶意更新非预期列
create or replace function public.merchant_update_product(
  p_product_id uuid,
  p_patch      jsonb
) returns public.products language plpgsql security definer as $$
declare
  v_product public.products;
  v_allowed text[] := array['name','price','description','is_active','cover_image'];
  v_key     text;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'invalid_input: field % not updatable', v_key;
    end if;
  end loop;

  update public.products
    set name        = coalesce(p_patch->>'name', name),
        price       = coalesce((p_patch->>'price')::numeric, price),
        description = coalesce(p_patch->>'description', description),
        is_active   = coalesce((p_patch->>'is_active')::boolean, is_active),
        cover_image = coalesce(p_patch->>'cover_image', cover_image),
        updated_at  = now()
    where id = p_product_id
    returning * into v_product;
  if not found then
    raise exception 'not_found: product';
  end if;

  perform public._merchant_write_audit(
    'update_product', 'product', p_product_id::text, p_patch
  );

  return v_product;
end;
$$;

create or replace function public.merchant_update_stock(
  p_product_id uuid,
  p_delta      integer,
  p_reason     text
) returns public.products language plpgsql security definer as $$
declare
  v_product public.products;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_input: delta must be non-zero';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'invalid_input: reason required';
  end if;

  update public.products
    set stock = greatest(0, coalesce(stock, 0) + p_delta),
        updated_at = now()
    where id = p_product_id
    returning * into v_product;
  if not found then
    raise exception 'not_found: product';
  end if;

  perform public._merchant_write_audit(
    'update_stock', 'product', p_product_id::text,
    jsonb_build_object('delta', p_delta, 'reason', p_reason, 'stock_after', v_product.stock)
  );

  return v_product;
end;
$$;

-- ========== 角色授予（仅 admin） ==========

create or replace function public.merchant_grant_role(
  p_user_id uuid,
  p_role    text  -- 'admin' | 'staff' | null（传 null 表示撤销）
) returns public.user_roles language plpgsql security definer as $$
declare
  v_row public.user_roles;
begin
  if not public.is_admin() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_role is not null and p_role not in ('admin','staff') then
    raise exception 'invalid_input: role must be admin or staff or null';
  end if;

  if p_role is null then
    delete from public.user_roles where user_id = p_user_id returning * into v_row;
    perform public._merchant_write_audit(
      'grant_role', 'user_role', p_user_id::text,
      jsonb_build_object('role', null)
    );
    return v_row;
  end if;

  insert into public.user_roles(user_id, role, created_by)
    values (p_user_id, p_role, auth.uid())
  on conflict (user_id) do update
    set role = excluded.role, created_by = excluded.created_by
    returning * into v_row;

  perform public._merchant_write_audit(
    'grant_role', 'user_role', p_user_id::text,
    jsonb_build_object('role', p_role)
  );

  return v_row;
end;
$$;

-- 权限：业务 RPC 全部开放给 authenticated，内部逻辑自行校验角色
grant execute on function public.merchant_ship_order(uuid, text, text)                to authenticated;
grant execute on function public.merchant_update_tracking(uuid, text, text)           to authenticated;
grant execute on function public.merchant_close_order(uuid, text)                     to authenticated;
grant execute on function public.merchant_approve_refund(uuid, numeric, text)         to authenticated;
grant execute on function public.merchant_reject_refund(uuid, text)                   to authenticated;
grant execute on function public.merchant_mark_refund_completed(uuid, text)           to authenticated;
grant execute on function public.merchant_update_product(uuid, jsonb)                 to authenticated;
grant execute on function public.merchant_update_stock(uuid, integer, text)           to authenticated;
grant execute on function public.merchant_grant_role(uuid, text)                      to authenticated;

revoke execute on function public._merchant_write_audit(text, text, text, jsonb) from public;
```

> **字段适配提示：** 若 `after_sale_requests` 没有 `merchant_note` / `reject_reason` / `refund_txn_id` / `completed_at`，在本 migration 顶部 `alter table ... add column if not exists` 补齐；若 `products` 没有 `cover_image`，白名单里删掉或改成实际列名。以实际 schema 为准。

**Step 3：执行 migration**

```bash
supabase db push
```
Expected: 无错误；`\df public.merchant_*` 可列出 9 个函数。

**Step 4：手工冒烟**

在 SQL 控制台以 admin 会话：
```sql
-- 准备：选一个 status=paid 的测试订单
select id, status from public.orders where status = 'paid' limit 1;

-- 调用 ship
select public.merchant_ship_order('<order_id>'::uuid, 'SF', 'SF1234567890');

-- 预期：订单 status=shipping，carrier/tracking_no 已写入；审计表多一条 action='ship_order'
select action, target_id, payload, created_at from public.merchant_audit_logs order by id desc limit 3;

-- 负向：以 staff 账号试图撤销 admin 的角色应失败
-- select public.merchant_grant_role('<id>'::uuid, null);  -- 期望 permission_denied
```

**Step 5：提交**

```bash
git add supabase/migrations/2026MMDD0002_merchant_console_rpcs.sql
git commit -m "feat(merchant): 新增 9 个 merchant_*() 业务 RPC

背景：商家端 MVP 的所有写动作走 RPC 收口（见
docs/plans/2026-04-17-merchant-console-design.md §3.4），统一完成权限校验、
状态校验、业务写入与审计落库。

改动：
- _merchant_write_audit(action,type,id,payload) 统一审计写入工具，revoke
  execute from public 防止被客户端直接调用。
- 订单履约：merchant_ship_order / merchant_update_tracking / merchant_close_order。
- 售后：merchant_approve_refund / merchant_reject_refund /
  merchant_mark_refund_completed。
- 商品与库存：merchant_update_product（白名单字段 patch）、
  merchant_update_stock（强制 delta 非零、必填原因，stock 下限 0）。
- 角色授予：merchant_grant_role 仅 admin 可调；传 role=null 表示撤销。
- 业务 RPC 统一 grant execute to authenticated，内部自行校验角色。

每个函数遵循「权限 → 状态 → 业务 → 审计」四步模板，任一失败整个事务回滚。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3：TypeScript 类型与 userStore 角色接入

**Files:**
- Modify: `src/types/database.ts`（追加 `UserRole`、`MerchantAuditLog` 两种类型）
- Modify: `src/stores/userStore.ts`（新增 `role` 字段与加载逻辑）
- Create: `src/lib/userRole.ts`（纯函数：从数据库行归一化为客户端 role 值）
- Create: `tests/userRole.test.ts`

**目标：** 让前端能读取当前登录用户的角色，并把"普通顾客 / staff / admin"三态统一用一个枚举承载。页面层后续只消费 `useUserStore(s => s.role)`。

**Step 1：先写失败测试**（`tests/userRole.test.ts`）

```ts
import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { normalizeUserRole } from "@/lib/userRole";

export async function runUserRoleTests() {
  console.log("[Suite] userRole");

  await runCase("null row → guest", () => {
    assert.equal(normalizeUserRole(null), "guest");
  });

  await runCase("admin row → admin", () => {
    assert.equal(normalizeUserRole({ role: "admin" }), "admin");
  });

  await runCase("staff row → staff", () => {
    assert.equal(normalizeUserRole({ role: "staff" }), "staff");
  });

  await runCase("unknown role → guest (兜底)", () => {
    assert.equal(normalizeUserRole({ role: "super" } as any), "guest");
  });
}
```

挂到 `tests/run-tests.ts` 尾部：
```ts
import { runUserRoleTests } from "./userRole.test";
// ... 在 main() 中追加：
await runUserRoleTests();
```

Run: `npm run test`
Expected: FAIL（`@/lib/userRole` 尚不存在）。

**Step 2：实现最小纯函数**（`src/lib/userRole.ts`）

```ts
// 客户端统一的角色枚举：guest（顾客） / staff / admin
export type UserRole = "guest" | "staff" | "admin";

// Supabase 返回的 user_roles 行可能是 null / 未知 role，这里统一归一化。
export function normalizeUserRole(
  row: { role?: string | null } | null | undefined,
): UserRole {
  const value = row?.role?.trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "staff") return "staff";
  return "guest";
}

export function isMerchantStaff(role: UserRole) {
  return role === "admin" || role === "staff";
}
```

Run: `npm run test`
Expected: PASS（4/4）。

**Step 3：追加数据库类型**（`src/types/database.ts`）

在文件尾部（或与其它表同级位置）追加：

```ts
export interface UserRole {
  user_id: string;
  role: "admin" | "staff";
  created_at: string;
  created_by: string | null;
}

export interface MerchantAuditLog {
  id: number;
  actor_id: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}
```

Run: `npm run typecheck`
Expected: PASS。

**Step 4：在 userStore 接入 role**

先查阅现有结构：
```bash
grep -nE "interface UserState|role|session" src/stores/userStore.ts | head -40
```

修改要点：
1. 在 state 类型里追加 `role: UserRole`，默认 `'guest'`。
2. 新增 action：`refreshUserRole()` —— 读 `auth.uid()`，`select role from user_roles where user_id = <uid>`，调用 `normalizeUserRole` 写回。
3. 在现有的"登录成功 / 会话恢复 / 用户初始化"链路（通常是 `initialize` / `onAuthStateChange`）的成功分支里调用 `refreshUserRole()`。
4. 退出登录时把 `role` 重置为 `'guest'`。

参考片段（按你仓库的实际 store 结构调整）：

```ts
import { normalizeUserRole, type UserRole } from "@/lib/userRole";

interface UserState {
  // ... 现有字段
  role: UserRole;
  refreshUserRole: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  // ... 现有 state
  role: "guest",

  refreshUserRole: async () => {
    const userId = get().session?.user?.id;
    if (!userId) {
      set({ role: "guest" });
      return;
    }
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle<{ role: string }>();
    if (error) {
      logWarn("userStore", "拉取用户角色失败", { error: error.message });
      set({ role: "guest" });
      return;
    }
    set({ role: normalizeUserRole(data) });
  },
}));
```

并在原 `initialize` / 登录成功处追加 `await get().refreshUserRole();`；登出处 `set({ role: 'guest' })`。

Run: `npm run check`
Expected: PASS（lint + typecheck + test 全绿）。

**Step 5：提交**

```bash
git add src/lib/userRole.ts tests/userRole.test.ts tests/run-tests.ts src/types/database.ts src/stores/userStore.ts
git commit -m "feat(merchant): userStore 加载 user_roles，暴露 guest/staff/admin

背景：商家端 MVP 需要页面层根据角色决定是否展示入口与操作按钮。
为避免各处直接读 user_roles 表，统一在 userStore 暴露一个 role 字段。

改动：
- 新增 src/lib/userRole.ts：UserRole 枚举 + normalizeUserRole 兜底 +
  isMerchantStaff 辅助，所有入口使用统一纯函数。
- tests/userRole.test.ts 覆盖 null / admin / staff / 未知四种分支。
- src/types/database.ts 追加 UserRole / MerchantAuditLog 两张表类型。
- src/stores/userStore.ts 新增 role 字段与 refreshUserRole()；在登录成功、
  会话恢复分支调用，登出时复位 guest。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4：「我的」页商家后台入口卡片

**Files:**
- Modify: `src/app/(tabs)/profile.tsx`
- Create: `src/components/merchant/MerchantEntryCard.tsx`

**目标：** 员工（`role=admin|staff`）在"我的"页能看到一张入口卡片，点击跳转 `/merchant/orders`。顾客看不到这张卡。

**Step 1：查阅现有 profile 页结构**

```bash
grep -n "Pressable\|router.push\|<Section" src/app/\(tabs\)/profile.tsx | head -30
```

记下现有条目（订单 / 优惠券 / 地址等）是怎么排列的，沿用同款视觉。

**Step 2：创建卡片组件**（`src/components/merchant/MerchantEntryCard.tsx`）

```tsx
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { isMerchantStaff, type UserRole } from "@/lib/userRole";

interface Props {
  role: UserRole;
}

// 仅当角色为 staff/admin 才渲染；顾客态直接返回 null 保持 profile 页布局不变。
export function MerchantEntryCard({ role }: Props) {
  if (!isMerchantStaff(role)) return null;

  const roleLabel = role === "admin" ? "管理员" : "员工";

  return (
    <Pressable
      onPress={() => router.push("/merchant/orders")}
      className="mx-4 my-2 rounded-2xl bg-primary-container px-4 py-4"
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <MaterialIcons name="storefront" size={24} color={Colors.primary} />
          <View>
            <Text className="text-on-primary-container text-base font-semibold">
              商家后台
            </Text>
            <Text className="text-on-primary-container text-xs opacity-70">
              当前身份：{roleLabel} · 处理订单、售后与商品
            </Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={Colors.primary} />
      </View>
    </Pressable>
  );
}
```

**Step 3：在 profile 页挂上卡片**

```tsx
// 顶部 imports
import { MerchantEntryCard } from "@/components/merchant/MerchantEntryCard";

// 组件内：
const role = useUserStore((s) => s.role);

// JSX 中，建议放在"我的订单"上方或头像区下方
<MerchantEntryCard role={role} />
```

**Step 4：联动验证**

Run: `npm run typecheck && npm run lint`
Expected: PASS。

手动在开发端验证（或等 Task 12 的端到端验收再一起跑）：
- 未登录 / 顾客账号：profile 页无此卡片。
- admin/staff 账号：能看到卡片，点击跳转 `/merchant/orders`（此时路由不存在会 404，Task 5/6 会补上）。

**Step 5：提交**

```bash
git add src/components/merchant/MerchantEntryCard.tsx "src/app/(tabs)/profile.tsx"
git commit -m "feat(merchant): 「我的」页新增商家后台入口卡片

背景：商家端使用与 C 端同一 App，需要一个对员工可见、顾客不可见的入口。
选择放在「我的」页是为了零侵入现有底部 Tab 结构（见 §4.1）。

改动：
- 新增 MerchantEntryCard，仅在 role ∈ {admin, staff} 时渲染，内部用
  isMerchantStaff 判定，不在调用方重复写条件。
- 卡片副标题附带当前角色，便于员工确认身份；点击跳转 /merchant/orders。
- profile.tsx 在现有入口列表外层追加该卡片，顾客态由组件自身返回 null，
  视觉布局完全不变。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5：`merchant/_layout.tsx` 权限守卫 + 顶部 3-Tab 骨架

**Files:**
- Create: `src/app/merchant/_layout.tsx`
- Create: `src/app/merchant/index.tsx`（仅做重定向到 `/merchant/orders`）

**目标：** 所有 `/merchant/*` 路由一进来先过权限守卫；通过后渲染顶部三段式 Tab（订单 / 售后 / 商品）作为后台骨架。Task 7+ 的三大模块页面挂进来即可。

**Step 1：写守卫 + Tab 骨架**（`src/app/merchant/_layout.tsx`）

```tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { AppHeader } from "@/components/ui/AppHeader";
import { Colors } from "@/constants/Colors";
import { isMerchantStaff } from "@/lib/userRole";
import { useUserStore } from "@/stores/userStore";

// 商家后台的顶部三段式导航：订单 / 售后 / 商品。
// 权限守卫逻辑集中在这里，子页面不用各自再判。
export default function MerchantLayout() {
  const session = useUserStore((s) => s.session);
  const role = useUserStore((s) => s.role);

  // 未登录：回登录页；登录成功后会从 login 页按原路返回
  if (!session) {
    return <Redirect href="/login" />;
  }
  // 已登录但非员工：回首页，避免员工身份被取消时仍残留商家路由
  if (!isMerchantStaff(role)) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <AppHeader title="商家后台" showBackButton />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarPosition: "top",
          tabBarActiveTintColor: Colors.primary,
          tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="orders"
          options={{
            title: "订单",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="receipt-long" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="after-sale"
          options={{
            title: "售后",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="assignment-return" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: "商品",
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="inventory-2" color={color} size={size} />
            ),
          }}
        />
        {/* index 仅做默认重定向，不在 Tab 中展示 */}
        <Tabs.Screen name="index" options={{ href: null }} />
      </Tabs>
    </>
  );
}
```

> **注：** 如果项目现有的 `expo-router` 版本不支持 `tabBarPosition: "top"`，改为 `Stack` + 一个自定义顶部 TabBar 组件（`src/components/merchant/MerchantTopTabs.tsx`），视觉效果一致即可。以 IDE 里 TypeScript 提示为准。

**Step 2：默认入口重定向**（`src/app/merchant/index.tsx`）

```tsx
import { Redirect } from "expo-router";

// 直接进入 /merchant 时，落到订单页（履约优先级最高）
export default function MerchantIndex() {
  return <Redirect href="/merchant/orders" />;
}
```

**Step 3：为了让路由通过，暂时放 3 个占位 tab 页面**

为避免 Tab 找不到 route 报错，先占坑：
- `src/app/merchant/orders/index.tsx`
- `src/app/merchant/after-sale/index.tsx`
- `src/app/merchant/products/index.tsx`

每个文件先放极简内容（Task 8/9/10 替换）：

```tsx
import { Text, View } from "react-native";

export default function Placeholder() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text>待实现</Text>
    </View>
  );
}
```

**Step 4：验证**

Run: `npm run typecheck && npm run lint`
Expected: PASS。

**Step 5：提交**

```bash
git add src/app/merchant/_layout.tsx src/app/merchant/index.tsx \
        src/app/merchant/orders/index.tsx \
        src/app/merchant/after-sale/index.tsx \
        src/app/merchant/products/index.tsx
git commit -m "feat(merchant): 新增 /merchant 路由组骨架与权限守卫

背景：商家后台与 C 端同 App 共存，需要一个集中式的权限守卫入口
（见 §4.2），避免在每个子页面重复判断；同时提供顶部三段式 Tab 骨架
供订单 / 售后 / 商品模块挂靠。

改动：
- merchant/_layout.tsx：未登录 → /login；登录但非员工 → /(tabs)；
  员工态渲染顶部 Tabs（订单 / 售后 / 商品 三项）。
- merchant/index.tsx：默认重定向到 /merchant/orders，履约优先级最高。
- 三个子模块预置占位页，后续 Task 替换实现。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6：`merchantRpc.ts` —— 9 个 RPC 的 TS 封装与错误归一化

**Files:**
- Create: `src/lib/merchantRpc.ts`
- Create: `src/lib/merchantErrors.ts`（纯函数：解析 Postgres 抛出的错误码/消息）
- Create: `tests/merchantErrors.test.ts`

**目标：** 页面层只调 `merchantRpc.shipOrder(id, carrier, no)` 这类方法，底层把 Supabase RPC 响应归一化，错误按 `permission_denied / state_conflict / invalid_input / not_found / network` 分类抛出，便于上层 toast 文案统一。

**Step 1：写失败测试**（`tests/merchantErrors.test.ts`）

```ts
import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { classifyMerchantError } from "@/lib/merchantErrors";

export async function runMerchantErrorsTests() {
  console.log("[Suite] merchantErrors");

  await runCase("42501 → permission_denied", () => {
    assert.deepEqual(
      classifyMerchantError({ code: "42501", message: "permission_denied" }),
      { kind: "permission_denied", message: "无权限执行该操作" },
    );
  });

  await runCase("message 含 state_conflict → state_conflict", () => {
    const result = classifyMerchantError({
      message: "state_conflict: order status must be paid, got shipping",
    });
    assert.equal(result.kind, "state_conflict");
    assert.ok(result.message.includes("状态"));
  });

  await runCase("message 含 not_found → not_found", () => {
    const result = classifyMerchantError({ message: "not_found: order" });
    assert.equal(result.kind, "not_found");
  });

  await runCase("message 含 invalid_input → invalid_input", () => {
    const result = classifyMerchantError({
      message: "invalid_input: carrier/tracking_no required",
    });
    assert.equal(result.kind, "invalid_input");
  });

  await runCase("空对象 → unknown", () => {
    assert.equal(classifyMerchantError({}).kind, "unknown");
  });
}
```

挂到 `tests/run-tests.ts`。Run: `npm run test`，Expected: FAIL。

**Step 2：实现错误分类**（`src/lib/merchantErrors.ts`）

```ts
export type MerchantErrorKind =
  | "permission_denied"
  | "state_conflict"
  | "invalid_input"
  | "not_found"
  | "network"
  | "unknown";

export interface MerchantError {
  kind: MerchantErrorKind;
  message: string;   // 面向用户的中文文案
  raw?: string;      // 原始错误消息，便于日志
}

// 把 Supabase / Postgres 的错误对象归一化为 {kind, message}。
// 为了保持纯函数，不依赖 Toast / logger。
export function classifyMerchantError(err: unknown): MerchantError {
  const raw = extractMessage(err);
  const code = extractCode(err);

  if (code === "42501" || /permission_denied/i.test(raw)) {
    return { kind: "permission_denied", message: "无权限执行该操作", raw };
  }
  if (/state_conflict/i.test(raw)) {
    return {
      kind: "state_conflict",
      message: `操作与当前状态冲突：${stripPrefix(raw, "state_conflict:")}`,
      raw,
    };
  }
  if (/not_found/i.test(raw)) {
    return { kind: "not_found", message: "目标对象不存在或已被删除", raw };
  }
  if (/invalid_input/i.test(raw)) {
    return {
      kind: "invalid_input",
      message: `参数不合法：${stripPrefix(raw, "invalid_input:")}`,
      raw,
    };
  }
  if (!raw) {
    return { kind: "unknown", message: "未知错误，请稍后重试" };
  }
  return { kind: "unknown", message: raw, raw };
}

function extractMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const m = (err as { message?: unknown }).message;
  return typeof m === "string" ? m.trim() : "";
}

function extractCode(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const c = (err as { code?: unknown }).code;
  return typeof c === "string" ? c : "";
}

function stripPrefix(value: string, prefix: string) {
  const idx = value.indexOf(prefix);
  return idx >= 0 ? value.slice(idx + prefix.length).trim() : value;
}
```

Run: `npm run test`，Expected: PASS。

**Step 3：写 RPC 封装**（`src/lib/merchantRpc.ts`）

```ts
import { supabase } from "@/lib/supabase";
import { classifyMerchantError, type MerchantError } from "@/lib/merchantErrors";
import type { Order, AfterSaleRequest, Product } from "@/types/database";

// 所有 merchantRpc.* 方法失败时都抛一个结构化的 MerchantError，
// 页面层统一用 try/catch + toast(err.message) 展示。
async function invoke<T>(
  fn: () => Promise<{ data: T | null; error: unknown }>,
): Promise<T> {
  try {
    const { data, error } = await fn();
    if (error) throw classifyMerchantError(error);
    if (data === null || data === undefined) {
      throw {
        kind: "unknown",
        message: "服务端未返回结果",
      } satisfies MerchantError;
    }
    return data;
  } catch (err) {
    if (isMerchantError(err)) throw err;
    throw classifyMerchantError(err);
  }
}

function isMerchantError(value: unknown): value is MerchantError {
  return Boolean(value) && typeof value === "object" && "kind" in (value as object);
}

// 订单履约
export const merchantRpc = {
  shipOrder: (orderId: string, carrier: string, trackingNo: string) =>
    invoke<Order>(() =>
      supabase.rpc("merchant_ship_order", {
        p_order_id: orderId,
        p_carrier: carrier,
        p_tracking_no: trackingNo,
      }),
    ),

  updateTracking: (orderId: string, carrier: string | null, trackingNo: string | null) =>
    invoke<Order>(() =>
      supabase.rpc("merchant_update_tracking", {
        p_order_id: orderId,
        p_carrier: carrier ?? "",
        p_tracking_no: trackingNo ?? "",
      }),
    ),

  closeOrder: (orderId: string, reason: string) =>
    invoke<Order>(() =>
      supabase.rpc("merchant_close_order", {
        p_order_id: orderId,
        p_reason: reason,
      }),
    ),

  // 售后
  approveRefund: (requestId: string, refundAmount: number, note: string) =>
    invoke<AfterSaleRequest>(() =>
      supabase.rpc("merchant_approve_refund", {
        p_request_id: requestId,
        p_refund_amount: refundAmount,
        p_note: note,
      }),
    ),

  rejectRefund: (requestId: string, reason: string) =>
    invoke<AfterSaleRequest>(() =>
      supabase.rpc("merchant_reject_refund", {
        p_request_id: requestId,
        p_reason: reason,
      }),
    ),

  markRefundCompleted: (requestId: string, txnId: string) =>
    invoke<AfterSaleRequest>(() =>
      supabase.rpc("merchant_mark_refund_completed", {
        p_request_id: requestId,
        p_txn_id: txnId,
      }),
    ),

  // 商品 / 库存
  updateProduct: (productId: string, patch: Record<string, unknown>) =>
    invoke<Product>(() =>
      supabase.rpc("merchant_update_product", {
        p_product_id: productId,
        p_patch: patch,
      }),
    ),

  updateStock: (productId: string, delta: number, reason: string) =>
    invoke<Product>(() =>
      supabase.rpc("merchant_update_stock", {
        p_product_id: productId,
        p_delta: delta,
        p_reason: reason,
      }),
    ),

  // 角色
  grantRole: (userId: string, role: "admin" | "staff" | null) =>
    invoke<unknown>(() =>
      supabase.rpc("merchant_grant_role", {
        p_user_id: userId,
        p_role: role,
      }),
    ),
};
```

**Step 4：验证**

Run: `npm run check`
Expected: PASS。

**Step 5：提交**

```bash
git add src/lib/merchantRpc.ts src/lib/merchantErrors.ts \
        tests/merchantErrors.test.ts tests/run-tests.ts
git commit -m "feat(merchant): 新增 merchantRpc 封装与错误归一化

背景：商家端 9 个业务 RPC 在页面层被高频调用，需要一个统一的入口
把 Supabase 返回的异常归一化为 {kind, message}，否则每页面都要自己
解析 Postgres 抛出的字符串。

改动：
- src/lib/merchantErrors.ts：classifyMerchantError 按 code/message
  分类为 permission_denied / state_conflict / invalid_input /
  not_found / unknown 五类，附中文文案；纯函数、无副作用。
- tests/merchantErrors.test.ts 覆盖五种分支 + 空输入。
- src/lib/merchantRpc.ts：merchantRpc.{shipOrder, updateTracking,
  closeOrder, approveRefund, rejectRefund, markRefundCompleted,
  updateProduct, updateStock, grantRole}，统一通过 invoke() 抛出
  结构化错误。页面层捕获后直接 toast(err.message) 即可。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7：`merchantStore` —— 列表状态、筛选、乐观更新

**Files:**
- Create: `src/stores/merchantStore.ts`
- Create: `src/lib/merchantFilters.ts`（纯函数：筛选与排序）
- Create: `tests/merchantFilters.test.ts`

**目标：** 一个 Zustand store 承载三大模块的列表数据与筛选状态；列表筛选用纯函数，便于单测。写操作统一走 Task 6 的 `merchantRpc`，乐观更新 + 失败回滚。

**Step 1：写失败测试**（`tests/merchantFilters.test.ts`）

```ts
import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  filterMerchantOrders,
  filterMerchantAfterSales,
  filterMerchantProducts,
} from "@/lib/merchantFilters";

export async function runMerchantFiltersTests() {
  console.log("[Suite] merchantFilters");

  const orders = [
    { id: "o1", status: "paid",     order_no: "A001", created_at: "2026-04-17T10:00:00Z" },
    { id: "o2", status: "shipping", order_no: "A002", created_at: "2026-04-17T09:00:00Z" },
    { id: "o3", status: "paid",     order_no: "A003", created_at: "2026-04-17T11:00:00Z" },
    { id: "o4", status: "cancelled",order_no: "B100", created_at: "2026-04-16T10:00:00Z" },
  ] as any[];

  await runCase("订单筛选：待发货", () => {
    const r = filterMerchantOrders(orders, { status: "pending_ship", keyword: "" });
    assert.deepEqual(r.map((o) => o.id), ["o3", "o1"]); // paid 按 created_at 倒序
  });

  await runCase("订单筛选：关键字模糊匹配 order_no", () => {
    const r = filterMerchantOrders(orders, { status: "all", keyword: "b10" });
    assert.deepEqual(r.map((o) => o.id), ["o4"]);
  });

  await runCase("售后筛选：待审核", () => {
    const list = [
      { id: "r1", status: "pending" },
      { id: "r2", status: "approved" },
    ] as any[];
    const r = filterMerchantAfterSales(list, { status: "pending" });
    assert.deepEqual(r.map((x) => x.id), ["r1"]);
  });

  await runCase("商品筛选：低库存 <10", () => {
    const list = [
      { id: "p1", stock: 3,  is_active: true,  name: "龙井" },
      { id: "p2", stock: 50, is_active: true,  name: "普洱" },
      { id: "p3", stock: 0,  is_active: false, name: "铁观音" },
    ] as any[];
    const r = filterMerchantProducts(list, { scope: "low_stock", keyword: "" });
    assert.deepEqual(r.map((x) => x.id).sort(), ["p1", "p3"]);
  });
}
```

挂到 `tests/run-tests.ts`。Run: `npm run test`，Expected: FAIL。

**Step 2：实现筛选纯函数**（`src/lib/merchantFilters.ts`）

```ts
import type { Order, AfterSaleRequest, Product } from "@/types/database";

// ========== 订单 ==========
export type MerchantOrderScope =
  | "all"
  | "pending_ship"  // paid
  | "shipping"
  | "delivered"
  | "cancelled";

export interface MerchantOrderFilter {
  status: MerchantOrderScope;
  keyword: string; // 订单号 / 收件人手机模糊匹配
}

export function filterMerchantOrders(list: Order[], filter: MerchantOrderFilter): Order[] {
  const keyword = filter.keyword.trim().toLowerCase();
  const matched = list.filter((order) => {
    const scopeHit =
      filter.status === "all" ||
      (filter.status === "pending_ship" && order.status === "paid") ||
      filter.status === order.status;
    if (!scopeHit) return false;
    if (!keyword) return true;
    const no = (order as any).order_no?.toLowerCase?.() ?? "";
    const phone = (order as any).contact_phone?.toLowerCase?.() ?? "";
    return no.includes(keyword) || phone.includes(keyword);
  });
  return matched.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

// ========== 售后 ==========
export type MerchantAfterSaleScope = "all" | "pending" | "approved" | "rejected" | "completed";

export function filterMerchantAfterSales(
  list: AfterSaleRequest[],
  filter: { status: MerchantAfterSaleScope },
): AfterSaleRequest[] {
  if (filter.status === "all") return [...list];
  return list.filter((r) => r.status === filter.status);
}

// ========== 商品 ==========
export type MerchantProductScope = "all" | "active" | "inactive" | "low_stock";

export interface MerchantProductFilter {
  scope: MerchantProductScope;
  keyword: string;
}

const LOW_STOCK_THRESHOLD = 10;

export function filterMerchantProducts(
  list: Product[],
  filter: MerchantProductFilter,
): Product[] {
  const keyword = filter.keyword.trim().toLowerCase();
  return list.filter((p) => {
    const scopeHit =
      filter.scope === "all" ||
      (filter.scope === "active"     && (p as any).is_active === true) ||
      (filter.scope === "inactive"   && (p as any).is_active === false) ||
      (filter.scope === "low_stock"  && (p.stock ?? 0) < LOW_STOCK_THRESHOLD);
    if (!scopeHit) return false;
    if (!keyword) return true;
    return p.name?.toLowerCase().includes(keyword);
  });
}
```

Run: `npm run test`，Expected: PASS。

**Step 3：实现 store**（`src/stores/merchantStore.ts`）

```ts
import { create } from "zustand";

import { logWarn } from "@/lib/logger";
import { merchantRpc } from "@/lib/merchantRpc";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { supabase } from "@/lib/supabase";
import type {
  MerchantOrderFilter,
  MerchantProductFilter,
  MerchantAfterSaleScope,
} from "@/lib/merchantFilters";
import type { Order, AfterSaleRequest, Product } from "@/types/database";

interface MerchantState {
  orders: Order[];
  ordersLoading: boolean;
  orderFilter: MerchantOrderFilter;

  afterSales: AfterSaleRequest[];
  afterSalesLoading: boolean;
  afterSaleFilter: { status: MerchantAfterSaleScope };

  products: Product[];
  productsLoading: boolean;
  productFilter: MerchantProductFilter;

  setOrderFilter: (patch: Partial<MerchantOrderFilter>) => void;
  setAfterSaleFilter: (patch: Partial<{ status: MerchantAfterSaleScope }>) => void;
  setProductFilter: (patch: Partial<MerchantProductFilter>) => void;

  fetchOrders: () => Promise<void>;
  fetchAfterSales: () => Promise<void>;
  fetchProducts: () => Promise<void>;

  // 写操作：乐观更新 + 失败回滚
  shipOrder: (orderId: string, carrier: string, trackingNo: string) => Promise<void>;
  closeOrder: (orderId: string, reason: string) => Promise<void>;

  approveRefund: (requestId: string, amount: number, note: string) => Promise<void>;
  rejectRefund: (requestId: string, reason: string) => Promise<void>;
  markRefundCompleted: (requestId: string, txnId: string) => Promise<void>;

  updateProduct: (productId: string, patch: Record<string, unknown>) => Promise<void>;
  updateStock: (productId: string, delta: number, reason: string) => Promise<void>;
}

export const useMerchantStore = create<MerchantState>((set, get) => ({
  orders: [], ordersLoading: false, orderFilter: { status: "pending_ship", keyword: "" },
  afterSales: [], afterSalesLoading: false, afterSaleFilter: { status: "pending" },
  products: [], productsLoading: false, productFilter: { scope: "all", keyword: "" },

  setOrderFilter: (patch) => set({ orderFilter: { ...get().orderFilter, ...patch } }),
  setAfterSaleFilter: (patch) =>
    set({ afterSaleFilter: { ...get().afterSaleFilter, ...patch } }),
  setProductFilter: (patch) => set({ productFilter: { ...get().productFilter, ...patch } }),

  fetchOrders: async () => {
    set({ ordersLoading: true });
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) logWarn("merchantStore", "拉取订单失败", { error: error.message });
    set({ orders: (data as Order[]) ?? [], ordersLoading: false });
  },

  fetchAfterSales: async () => {
    set({ afterSalesLoading: true });
    const { data, error } = await supabase
      .from("after_sale_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) logWarn("merchantStore", "拉取售后失败", { error: error.message });
    set({ afterSales: (data as AfterSaleRequest[]) ?? [], afterSalesLoading: false });
  },

  fetchProducts: async () => {
    set({ productsLoading: true });
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) logWarn("merchantStore", "拉取商品失败", { error: error.message });
    set({ products: (data as Product[]) ?? [], productsLoading: false });
  },

  shipOrder: async (orderId, carrier, trackingNo) => {
    const prev = get().orders;
    // 乐观更新
    set({
      orders: prev.map((o) =>
        o.id === orderId ? { ...o, status: "shipping", carrier, tracking_no: trackingNo } as Order : o,
      ),
    });
    try {
      const updated = await merchantRpc.shipOrder(orderId, carrier, trackingNo);
      set({ orders: get().orders.map((o) => (o.id === orderId ? updated : o)) });
    } catch (err) {
      set({ orders: prev });
      throw classifyMerchantError(err);
    }
  },

  closeOrder: async (orderId, reason) => {
    const prev = get().orders;
    set({
      orders: prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } as Order : o)),
    });
    try {
      const updated = await merchantRpc.closeOrder(orderId, reason);
      set({ orders: get().orders.map((o) => (o.id === orderId ? updated : o)) });
    } catch (err) {
      set({ orders: prev });
      throw classifyMerchantError(err);
    }
  },

  approveRefund: async (requestId, amount, note) => {
    const prev = get().afterSales;
    try {
      const updated = await merchantRpc.approveRefund(requestId, amount, note);
      set({ afterSales: prev.map((r) => (r.id === requestId ? updated : r)) });
    } catch (err) {
      set({ afterSales: prev });
      throw classifyMerchantError(err);
    }
  },

  rejectRefund: async (requestId, reason) => {
    const prev = get().afterSales;
    try {
      const updated = await merchantRpc.rejectRefund(requestId, reason);
      set({ afterSales: prev.map((r) => (r.id === requestId ? updated : r)) });
    } catch (err) {
      set({ afterSales: prev });
      throw classifyMerchantError(err);
    }
  },

  markRefundCompleted: async (requestId, txnId) => {
    const prev = get().afterSales;
    try {
      const updated = await merchantRpc.markRefundCompleted(requestId, txnId);
      set({ afterSales: prev.map((r) => (r.id === requestId ? updated : r)) });
    } catch (err) {
      set({ afterSales: prev });
      throw classifyMerchantError(err);
    }
  },

  updateProduct: async (productId, patch) => {
    const prev = get().products;
    try {
      const updated = await merchantRpc.updateProduct(productId, patch);
      set({ products: prev.map((p) => (p.id === productId ? updated : p)) });
    } catch (err) {
      set({ products: prev });
      throw classifyMerchantError(err);
    }
  },

  updateStock: async (productId, delta, reason) => {
    const prev = get().products;
    try {
      const updated = await merchantRpc.updateStock(productId, delta, reason);
      set({ products: prev.map((p) => (p.id === productId ? updated : p)) });
    } catch (err) {
      set({ products: prev });
      throw classifyMerchantError(err);
    }
  },
}));
```

**Step 4：验证**

Run: `npm run check`
Expected: PASS。

**Step 5：提交**

```bash
git add src/stores/merchantStore.ts src/lib/merchantFilters.ts \
        tests/merchantFilters.test.ts tests/run-tests.ts
git commit -m "feat(merchant): 新增 merchantStore 与筛选纯函数

背景：商家端三大模块的列表状态、筛选与写操作需要一个集中 store
承载，否则每个页面会重复搓 fetch / 乐观更新 / 回滚逻辑。

改动：
- src/lib/merchantFilters.ts：filterMerchantOrders / AfterSales /
  Products 三个纯函数，筛选 + 关键字 + 排序集中收口，便于测试。
- tests/merchantFilters.test.ts 覆盖订单待发货 / 关键字、售后待审核、
  商品低库存三个代表性场景。
- src/stores/merchantStore.ts：orders/afterSales/products 三路状态，
  对应的 filter 与 setter，fetch*() 拉取，写操作统一通过 merchantRpc +
  乐观更新 + 异常回滚（复用 classifyMerchantError 归一化错误）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8：订单履约模块（列表 + 详情 + 发货弹窗）

**Files:**
- Rewrite: `src/app/merchant/orders/index.tsx`（列表）
- Create: `src/app/merchant/orders/[id].tsx`（详情）
- Create: `src/components/merchant/MerchantOrderCard.tsx`
- Create: `src/components/merchant/MerchantOrderFilterBar.tsx`
- Create: `src/components/merchant/ShipOrderDialog.tsx`

**目标：** 交付订单履约主流程：列表 → 筛选 → 点击进入详情 → 发货（弹窗填承运商/单号）或关闭订单。状态流转只支持 `paid → shipping`，其它状态展示为只读。

**Step 1：列表页**（`src/app/merchant/orders/index.tsx`）

```tsx
import { useEffect, useMemo } from "react";
import { FlatList, View } from "react-native";

import { MerchantOrderCard } from "@/components/merchant/MerchantOrderCard";
import { MerchantOrderFilterBar } from "@/components/merchant/MerchantOrderFilterBar";
import { ScreenState } from "@/components/ui/ScreenState";
import { filterMerchantOrders } from "@/lib/merchantFilters";
import { useMerchantStore } from "@/stores/merchantStore";

export default function MerchantOrdersScreen() {
  const orders = useMerchantStore((s) => s.orders);
  const loading = useMerchantStore((s) => s.ordersLoading);
  const filter = useMerchantStore((s) => s.orderFilter);
  const setFilter = useMerchantStore((s) => s.setOrderFilter);
  const fetchOrders = useMerchantStore((s) => s.fetchOrders);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  const visible = useMemo(() => filterMerchantOrders(orders, filter), [orders, filter]);

  return (
    <View className="flex-1 bg-surface">
      <MerchantOrderFilterBar filter={filter} onChange={setFilter} />
      {loading && visible.length === 0 ? (
        <ScreenState status="loading" />
      ) : visible.length === 0 ? (
        <ScreenState status="empty" title="暂无匹配订单" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MerchantOrderCard order={item} />}
          onRefresh={fetchOrders}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
```

**Step 2：筛选栏组件**（`MerchantOrderFilterBar.tsx`）

```tsx
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import type { MerchantOrderFilter, MerchantOrderScope } from "@/lib/merchantFilters";

const SCOPES: { value: MerchantOrderScope; label: string }[] = [
  { value: "pending_ship", label: "待发货" },
  { value: "shipping", label: "已发货" },
  { value: "delivered", label: "已完成" },
  { value: "cancelled", label: "已取消" },
  { value: "all", label: "全部" },
];

interface Props {
  filter: MerchantOrderFilter;
  onChange: (patch: Partial<MerchantOrderFilter>) => void;
}

export function MerchantOrderFilterBar({ filter, onChange }: Props) {
  return (
    <View className="px-4 py-3 gap-2 border-b border-outline-variant">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {SCOPES.map((s) => {
          const active = filter.status === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => onChange({ status: s.value })}
              className={`px-3 py-1.5 rounded-full mr-2 ${active ? "bg-primary" : "bg-surface-variant"}`}
            >
              <Text className={active ? "text-white text-sm" : "text-on-surface text-sm"}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <TextInput
        placeholder="搜索订单号 / 收件人手机"
        value={filter.keyword}
        onChangeText={(v) => onChange({ keyword: v })}
        className="px-3 py-2 rounded-lg bg-surface-variant text-sm"
      />
    </View>
  );
}
```

**Step 3：订单卡片**（`MerchantOrderCard.tsx`）

```tsx
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { Order } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  pending:   "待支付",
  paid:      "待发货",
  shipping:  "已发货",
  delivered: "已完成",
  cancelled: "已取消",
};

export function MerchantOrderCard({ order }: { order: Order }) {
  return (
    <Pressable
      onPress={() => router.push(`/merchant/orders/${order.id}`)}
      className="mx-4 my-2 p-4 rounded-2xl bg-surface-bright"
    >
      <View className="flex-row justify-between mb-2">
        <Text className="text-on-surface text-sm font-semibold">
          {(order as any).order_no ?? order.id.slice(0, 8)}
        </Text>
        <Text className="text-primary text-xs">{STATUS_LABEL[order.status] ?? order.status}</Text>
      </View>
      <Text className="text-on-surface-variant text-xs">
        下单时间：{new Date(order.created_at).toLocaleString("zh-CN")}
      </Text>
      <Text className="text-on-surface-variant text-xs">
        金额：¥{(order as any).total_amount ?? "-"}
      </Text>
    </Pressable>
  );
}
```

**Step 4：发货弹窗**（`ShipOrderDialog.tsx`）

```tsx
import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (carrier: string, trackingNo: string) => Promise<void>;
}

export function ShipOrderDialog({ visible, onClose, onSubmit }: Props) {
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = carrier.trim().length > 0 && trackingNo.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit(carrier.trim(), trackingNo.trim());
      setCarrier("");
      setTrackingNo("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full bg-surface-bright rounded-2xl p-5 gap-3">
          <Text className="text-on-surface text-lg font-semibold">填写发货信息</Text>
          <TextInput
            value={carrier}
            onChangeText={setCarrier}
            placeholder="承运商（如：顺丰）"
            className="border border-outline-variant rounded-lg px-3 py-2"
          />
          <TextInput
            value={trackingNo}
            onChangeText={setTrackingNo}
            placeholder="运单号"
            className="border border-outline-variant rounded-lg px-3 py-2"
          />
          <View className="flex-row justify-end gap-3 mt-2">
            <Pressable onPress={onClose} className="px-4 py-2">
              <Text className="text-on-surface-variant">取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              className={`px-4 py-2 rounded-lg ${canSubmit ? "bg-primary" : "bg-surface-variant"}`}
            >
              <Text className={canSubmit ? "text-white" : "text-on-surface-variant"}>
                {loading ? "提交中…" : "确认发货"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

**Step 5：详情页**（`src/app/merchant/orders/[id].tsx`）

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View, Pressable, Alert } from "react-native";

import { ShipOrderDialog } from "@/components/merchant/ShipOrderDialog";
import { AppHeader } from "@/components/ui/AppHeader";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { showConfirm } from "@/stores/modalStore";
import { useMerchantStore } from "@/stores/merchantStore";

export default function MerchantOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orders = useMerchantStore((s) => s.orders);
  const shipOrder = useMerchantStore((s) => s.shipOrder);
  const closeOrder = useMerchantStore((s) => s.closeOrder);

  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id]);
  const [showShip, setShowShip] = useState(false);

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>订单不存在或未加载</Text>
      </View>
    );
  }

  const canShip = order.status === "paid";
  const canClose = !["delivered", "cancelled"].includes(order.status);

  const handleShip = async (carrier: string, no: string) => {
    try {
      await shipOrder(order.id, carrier, no);
      Alert.alert("发货成功");
    } catch (err) {
      Alert.alert("发货失败", classifyMerchantError(err).message);
    }
  };

  const handleClose = () => {
    showConfirm({
      title: "确认关闭订单？",
      description: "关闭后不可恢复；如需退款请走售后流程。",
      onConfirm: async () => {
        try {
          await closeOrder(order.id, "商家关闭");
          router.back();
        } catch (err) {
          Alert.alert("操作失败", classifyMerchantError(err).message);
        }
      },
    });
  };

  return (
    <>
      <AppHeader title="订单详情" showBackButton />
      <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="text-on-surface text-base font-semibold">
          订单号：{(order as any).order_no ?? order.id}
        </Text>
        <Text>状态：{order.status}</Text>
        <Text>下单时间：{new Date(order.created_at).toLocaleString("zh-CN")}</Text>
        <Text>金额：¥{(order as any).total_amount ?? "-"}</Text>
        {(order as any).carrier && (
          <Text>承运商：{(order as any).carrier}（{(order as any).tracking_no}）</Text>
        )}
        {/* TODO：此处可按需展示 order_items 列表、收件地址等，复用 C 端原子组件 */}

        <View className="flex-row gap-3 mt-4">
          {canShip && (
            <Pressable
              onPress={() => setShowShip(true)}
              className="flex-1 bg-primary rounded-lg py-3 items-center"
            >
              <Text className="text-white">发货</Text>
            </Pressable>
          )}
          {canClose && (
            <Pressable
              onPress={handleClose}
              className="flex-1 border border-outline rounded-lg py-3 items-center"
            >
              <Text className="text-on-surface">关闭订单</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <ShipOrderDialog
        visible={showShip}
        onClose={() => setShowShip(false)}
        onSubmit={handleShip}
      />
    </>
  );
}
```

**Step 6：验证**

Run: `npm run check`
Expected: PASS。

手动：以 staff 账号登录 → 点击"商家后台" → 看到订单列表 → 切筛选 → 进入一个 paid 订单 → 发货弹窗填单 → 成功后状态变 shipping。

**Step 7：提交**

```bash
git add src/app/merchant/orders/index.tsx src/app/merchant/orders/\[id\].tsx \
        src/components/merchant/MerchantOrderCard.tsx \
        src/components/merchant/MerchantOrderFilterBar.tsx \
        src/components/merchant/ShipOrderDialog.tsx
git commit -m "feat(merchant): 订单履约列表 / 详情 / 发货流程

背景：商家端 MVP 首要能力是把 paid 订单推到 shipping（见 §4.3 A）。
本次交付完整的列表 → 详情 → 发货弹窗 / 关闭订单闭环。

改动：
- merchant/orders/index.tsx：FlatList + 筛选栏，默认显示待发货；
  列表项复用卡片组件跳详情。
- MerchantOrderFilterBar：横向滚动 chips + 关键字输入，状态完全受控。
- MerchantOrderCard：精简信息卡（订单号 / 状态 / 时间 / 金额）。
- ShipOrderDialog：承运商 + 运单号双输入，提交中禁用按钮。
- merchant/orders/[id].tsx：详情只读展示 + 底部操作条；只有 paid 态
  才展示发货按钮，delivered/cancelled 不能再关闭。
- 错误统一走 classifyMerchantError，Alert 出中文文案。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9：售后处理模块（列表 + 详情 + 同意/拒绝/打款）

**Files:**
- Rewrite: `src/app/merchant/after-sale/index.tsx`
- Create: `src/app/merchant/after-sale/[id].tsx`
- Create: `src/components/merchant/MerchantAfterSaleCard.tsx`
- Create: `src/components/merchant/AfterSaleActionSheet.tsx`（同意金额输入 / 拒绝理由 / 打款 txn_id）

**目标：** 商家可查看全部售后申请、筛选状态、进入详情做同意 / 拒绝 / 标记已打款三种动作。打款本身由运营线下完成，这里只流转状态并记录 txn_id。

**Step 1：列表页**

```tsx
import { useEffect, useMemo } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";

import { MerchantAfterSaleCard } from "@/components/merchant/MerchantAfterSaleCard";
import { ScreenState } from "@/components/ui/ScreenState";
import {
  filterMerchantAfterSales,
  type MerchantAfterSaleScope,
} from "@/lib/merchantFilters";
import { useMerchantStore } from "@/stores/merchantStore";

const SCOPES: { value: MerchantAfterSaleScope; label: string }[] = [
  { value: "pending",   label: "待审核" },
  { value: "approved",  label: "已同意" },
  { value: "rejected",  label: "已拒绝" },
  { value: "completed", label: "已完成" },
  { value: "all",       label: "全部" },
];

export default function MerchantAfterSaleScreen() {
  const list = useMerchantStore((s) => s.afterSales);
  const loading = useMerchantStore((s) => s.afterSalesLoading);
  const filter = useMerchantStore((s) => s.afterSaleFilter);
  const setFilter = useMerchantStore((s) => s.setAfterSaleFilter);
  const fetch = useMerchantStore((s) => s.fetchAfterSales);

  useEffect(() => { void fetch(); }, [fetch]);
  const visible = useMemo(() => filterMerchantAfterSales(list, filter), [list, filter]);

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-3 border-b border-outline-variant"
      >
        {SCOPES.map((s) => {
          const active = filter.status === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => setFilter({ status: s.value })}
              className={`px-3 py-1.5 rounded-full mr-2 ${active ? "bg-primary" : "bg-surface-variant"}`}
            >
              <Text className={active ? "text-white text-sm" : "text-on-surface text-sm"}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && visible.length === 0 ? (
        <ScreenState status="loading" />
      ) : visible.length === 0 ? (
        <ScreenState status="empty" title="暂无匹配售后申请" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(x) => x.id}
          renderItem={({ item }) => <MerchantAfterSaleCard request={item} />}
          onRefresh={fetch}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
```

**Step 2：卡片与动作面板**

`MerchantAfterSaleCard.tsx`：

```tsx
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { AfterSaleRequest } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  pending:   "待审核",
  approved:  "已同意",
  rejected:  "已拒绝",
  completed: "已完成",
};

export function MerchantAfterSaleCard({ request }: { request: AfterSaleRequest }) {
  return (
    <Pressable
      onPress={() => router.push(`/merchant/after-sale/${request.id}`)}
      className="mx-4 my-2 p-4 rounded-2xl bg-surface-bright"
    >
      <View className="flex-row justify-between mb-1">
        <Text className="text-on-surface font-semibold">
          申请 {request.id.slice(0, 8)}
        </Text>
        <Text className="text-primary text-xs">{STATUS_LABEL[request.status] ?? request.status}</Text>
      </View>
      <Text className="text-on-surface-variant text-xs">
        订单：{(request as any).order_id?.slice?.(0, 8) ?? "-"}
      </Text>
      <Text className="text-on-surface-variant text-xs">
        诉求金额：¥{(request as any).refund_amount ?? "-"}
      </Text>
    </Pressable>
  );
}
```

`AfterSaleActionSheet.tsx`（一个弹窗承载三种动作，由调用方决定当前展示哪种）：

```tsx
import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

export type AfterSaleAction = "approve" | "reject" | "complete";

interface Props {
  visible: boolean;
  action: AfterSaleAction | null;
  defaultAmount?: number;
  onClose: () => void;
  onSubmit: (payload: { amount?: number; text: string }) => Promise<void>;
}

export function AfterSaleActionSheet({
  visible, action, defaultAmount, onClose, onSubmit,
}: Props) {
  const [amount, setAmount] = useState(String(defaultAmount ?? ""));
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  if (!action) return null;

  const title =
    action === "approve"  ? "同意退款" :
    action === "reject"   ? "拒绝申请" : "标记已打款";

  const textPlaceholder =
    action === "approve"  ? "备注（可选）" :
    action === "reject"   ? "请填写拒绝理由（必填）" : "第三方退款交易号（必填）";

  const canSubmit = (() => {
    if (loading) return false;
    if (action === "approve") return Number(amount) > 0;
    if (action === "reject")  return text.trim().length > 0;
    if (action === "complete")return text.trim().length > 0;
    return false;
  })();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit({
        amount: action === "approve" ? Number(amount) : undefined,
        text: text.trim(),
      });
      setText(""); setAmount(""); onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full bg-surface-bright rounded-2xl p-5 gap-3">
          <Text className="text-on-surface text-lg font-semibold">{title}</Text>

          {action === "approve" && (
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="实际退款金额"
              className="border border-outline-variant rounded-lg px-3 py-2"
            />
          )}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={textPlaceholder}
            className="border border-outline-variant rounded-lg px-3 py-2"
            multiline={action !== "complete"}
          />

          <View className="flex-row justify-end gap-3 mt-2">
            <Pressable onPress={onClose} className="px-4 py-2">
              <Text className="text-on-surface-variant">取消</Text>
            </Pressable>
            <Pressable
              disabled={!canSubmit}
              onPress={handleSubmit}
              className={`px-4 py-2 rounded-lg ${canSubmit ? "bg-primary" : "bg-surface-variant"}`}
            >
              <Text className={canSubmit ? "text-white" : "text-on-surface-variant"}>
                {loading ? "提交中…" : "确认"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

**Step 3：详情页**（`src/app/merchant/after-sale/[id].tsx`）

```tsx
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import {
  AfterSaleActionSheet,
  type AfterSaleAction,
} from "@/components/merchant/AfterSaleActionSheet";
import { AppHeader } from "@/components/ui/AppHeader";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { useMerchantStore } from "@/stores/merchantStore";

export default function MerchantAfterSaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useMerchantStore((s) => s.afterSales);
  const approve = useMerchantStore((s) => s.approveRefund);
  const reject = useMerchantStore((s) => s.rejectRefund);
  const complete = useMerchantStore((s) => s.markRefundCompleted);

  const request = useMemo(() => list.find((r) => r.id === id), [list, id]);
  const [action, setAction] = useState<AfterSaleAction | null>(null);

  if (!request) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>申请不存在或未加载</Text>
      </View>
    );
  }

  const handleSubmit = async ({ amount, text }: { amount?: number; text: string }) => {
    try {
      if (action === "approve")   await approve(request.id, amount ?? 0, text);
      if (action === "reject")    await reject(request.id, text);
      if (action === "complete")  await complete(request.id, text);
      Alert.alert("操作成功");
    } catch (err) {
      Alert.alert("操作失败", classifyMerchantError(err).message);
    }
  };

  const status = request.status;
  const canApproveOrReject = status === "pending";
  const canComplete = status === "approved";

  return (
    <>
      <AppHeader title="售后详情" showBackButton />
      <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="text-on-surface font-semibold">申请 ID：{request.id}</Text>
        <Text>状态：{status}</Text>
        <Text>订单：{(request as any).order_id}</Text>
        <Text>诉求金额：¥{(request as any).refund_amount}</Text>
        <Text>诉求描述：{(request as any).reason ?? "-"}</Text>
        {(request as any).merchant_note && (
          <Text>商家备注：{(request as any).merchant_note}</Text>
        )}
        {(request as any).refund_txn_id && (
          <Text>退款交易号：{(request as any).refund_txn_id}</Text>
        )}

        <View className="flex-row gap-3 mt-4 flex-wrap">
          {canApproveOrReject && (
            <>
              <Pressable
                onPress={() => setAction("approve")}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-white">同意退款</Text>
              </Pressable>
              <Pressable
                onPress={() => setAction("reject")}
                className="flex-1 border border-outline rounded-lg py-3 items-center"
              >
                <Text className="text-on-surface">拒绝</Text>
              </Pressable>
            </>
          )}
          {canComplete && (
            <Pressable
              onPress={() => setAction("complete")}
              className="flex-1 bg-primary rounded-lg py-3 items-center"
            >
              <Text className="text-white">标记已打款</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <AfterSaleActionSheet
        visible={action !== null}
        action={action}
        defaultAmount={(request as any).refund_amount}
        onClose={() => setAction(null)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
```

**Step 4：验证 & 提交**

Run: `npm run check`，Expected: PASS。

```bash
git add src/app/merchant/after-sale/index.tsx \
        src/app/merchant/after-sale/\[id\].tsx \
        src/components/merchant/MerchantAfterSaleCard.tsx \
        src/components/merchant/AfterSaleActionSheet.tsx
git commit -m "feat(merchant): 售后处理列表 / 详情 / 同意-拒绝-打款

背景：设计稿 §4.3 B 要求商家侧能流转 after_sale_requests 状态：
pending → approved / rejected，approved → completed（打款由线下
完成，仅记录 txn_id）。

改动：
- after-sale/index.tsx 顶部 chips 筛选 + 列表；默认落在“待审核”。
- MerchantAfterSaleCard 精简卡片，点击进详情。
- AfterSaleActionSheet 一个弹窗承载三种动作（approve / reject /
  complete），根据当前 action 动态切换输入项：
  · approve 必填退款金额；
  · reject 必填拒绝理由；
  · complete 必填退款 txn_id。
- after-sale/[id].tsx 按 status 分支展示可用按钮，防止越权操作。
- 错误统一 classifyMerchantError 显示中文 toast。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10：商品 / 库存管理模块

**Files:**
- Rewrite: `src/app/merchant/products/index.tsx`
- Create: `src/app/merchant/products/[id].tsx`
- Create: `src/components/merchant/MerchantProductCard.tsx`
- Create: `src/components/merchant/StockAdjustPanel.tsx`

**目标：** 列表可看全量商品（含下架、按上下架/低库存筛选）；详情页支持改价/改标题/改描述/上下架 + 独立的库存增减（强制填原因）。不做"新建商品"（V2）。

**Step 1：列表页**

```tsx
import { useEffect, useMemo } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { MerchantProductCard } from "@/components/merchant/MerchantProductCard";
import { ScreenState } from "@/components/ui/ScreenState";
import {
  filterMerchantProducts,
  type MerchantProductScope,
} from "@/lib/merchantFilters";
import { useMerchantStore } from "@/stores/merchantStore";

const SCOPES: { value: MerchantProductScope; label: string }[] = [
  { value: "all",       label: "全部" },
  { value: "active",    label: "已上架" },
  { value: "inactive",  label: "已下架" },
  { value: "low_stock", label: "低库存" },
];

export default function MerchantProductsScreen() {
  const products = useMerchantStore((s) => s.products);
  const loading = useMerchantStore((s) => s.productsLoading);
  const filter = useMerchantStore((s) => s.productFilter);
  const setFilter = useMerchantStore((s) => s.setProductFilter);
  const fetch = useMerchantStore((s) => s.fetchProducts);

  useEffect(() => { void fetch(); }, [fetch]);
  const visible = useMemo(() => filterMerchantProducts(products, filter), [products, filter]);

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 py-3 gap-2 border-b border-outline-variant">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SCOPES.map((s) => {
            const active = filter.scope === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setFilter({ scope: s.value })}
                className={`px-3 py-1.5 rounded-full mr-2 ${active ? "bg-primary" : "bg-surface-variant"}`}
              >
                <Text className={active ? "text-white text-sm" : "text-on-surface text-sm"}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextInput
          value={filter.keyword}
          onChangeText={(v) => setFilter({ keyword: v })}
          placeholder="搜索商品名"
          className="px-3 py-2 rounded-lg bg-surface-variant text-sm"
        />
      </View>

      {loading && visible.length === 0 ? (
        <ScreenState status="loading" />
      ) : visible.length === 0 ? (
        <ScreenState status="empty" title="暂无匹配商品" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(x) => x.id}
          renderItem={({ item }) => <MerchantProductCard product={item} />}
          onRefresh={fetch}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
```

**Step 2：卡片**（`MerchantProductCard.tsx`）

```tsx
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { Product } from "@/types/database";

export function MerchantProductCard({ product }: { product: Product }) {
  const active = (product as any).is_active !== false;
  const low = (product.stock ?? 0) < 10;

  return (
    <Pressable
      onPress={() => router.push(`/merchant/products/${product.id}`)}
      className="mx-4 my-2 p-4 rounded-2xl bg-surface-bright flex-row items-center justify-between"
    >
      <View className="flex-1">
        <Text className="text-on-surface font-semibold" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="text-on-surface-variant text-xs mt-1">
          ¥{product.price} · 库存 {product.stock ?? 0}
          {low ? " · ⚠️ 低库存" : ""}
        </Text>
      </View>
      <Text className={`text-xs ${active ? "text-primary" : "text-on-surface-variant"}`}>
        {active ? "已上架" : "已下架"}
      </Text>
    </Pressable>
  );
}
```

**Step 3：库存调整面板**（`StockAdjustPanel.tsx`）

```tsx
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

interface Props {
  currentStock: number;
  onSubmit: (delta: number, reason: string) => Promise<void>;
}

// 独立块：当前库存显示 + delta 输入（可正可负） + 必填原因
export function StockAdjustPanel({ currentStock, onSubmit }: Props) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const deltaNum = Number(delta);
  const canSubmit =
    !loading &&
    Number.isFinite(deltaNum) &&
    deltaNum !== 0 &&
    reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit(deltaNum, reason.trim());
      setDelta(""); setReason("");
      Alert.alert("库存已更新");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-2 p-4 rounded-2xl bg-surface-bright">
      <Text className="text-on-surface font-semibold">库存调整</Text>
      <Text className="text-on-surface-variant text-xs">当前库存：{currentStock}</Text>
      <TextInput
        value={delta}
        onChangeText={setDelta}
        keyboardType="numbers-and-punctuation"
        placeholder="调整量（正数入库 / 负数出库）"
        className="border border-outline-variant rounded-lg px-3 py-2"
      />
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="调整原因（必填，便于审计）"
        className="border border-outline-variant rounded-lg px-3 py-2"
      />
      <Pressable
        disabled={!canSubmit}
        onPress={handleSubmit}
        className={`rounded-lg py-2.5 items-center mt-1 ${canSubmit ? "bg-primary" : "bg-surface-variant"}`}
      >
        <Text className={canSubmit ? "text-white" : "text-on-surface-variant"}>
          {loading ? "提交中…" : "提交调整"}
        </Text>
      </Pressable>
    </View>
  );
}
```

**Step 4：详情/编辑页**（`src/app/merchant/products/[id].tsx`）

```tsx
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { StockAdjustPanel } from "@/components/merchant/StockAdjustPanel";
import { AppHeader } from "@/components/ui/AppHeader";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { useMerchantStore } from "@/stores/merchantStore";

export default function MerchantProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const products = useMerchantStore((s) => s.products);
  const updateProduct = useMerchantStore((s) => s.updateProduct);
  const updateStock = useMerchantStore((s) => s.updateStock);

  const product = useMemo(() => products.find((p) => p.id === id), [products, id]);

  // 表单本地 state：拿到 product 后初始化一次，避免每次 render 重置
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setName(product.name ?? "");
    setPrice(String(product.price ?? ""));
    setDescription((product as any).description ?? "");
    setIsActive((product as any).is_active !== false);
  }, [product?.id]); // 只在商品切换时重置

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>商品不存在或未加载</Text>
      </View>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProduct(product.id, {
        name,
        price: Number(price),
        description,
        is_active: isActive,
      });
      Alert.alert("保存成功");
    } catch (err) {
      Alert.alert("保存失败", classifyMerchantError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleStock = async (delta: number, reason: string) => {
    try {
      await updateStock(product.id, delta, reason);
    } catch (err) {
      Alert.alert("调整失败", classifyMerchantError(err).message);
      throw err; // 让面板回到非 loading 但不清空
    }
  };

  return (
    <>
      <AppHeader title="商品编辑" showBackButton />
      <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View className="gap-2 p-4 rounded-2xl bg-surface-bright">
          <Text className="text-on-surface font-semibold">基本信息</Text>
          <TextInput
            value={name} onChangeText={setName} placeholder="商品名"
            className="border border-outline-variant rounded-lg px-3 py-2"
          />
          <TextInput
            value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="价格"
            className="border border-outline-variant rounded-lg px-3 py-2"
          />
          <TextInput
            value={description} onChangeText={setDescription} placeholder="描述" multiline
            className="border border-outline-variant rounded-lg px-3 py-2 min-h-[80px]"
          />
          <View className="flex-row items-center justify-between">
            <Text>上架状态</Text>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>
          <Pressable
            disabled={saving}
            onPress={handleSave}
            className={`rounded-lg py-2.5 items-center mt-1 ${saving ? "bg-surface-variant" : "bg-primary"}`}
          >
            <Text className={saving ? "text-on-surface-variant" : "text-white"}>
              {saving ? "保存中…" : "保存基本信息"}
            </Text>
          </Pressable>
        </View>

        <StockAdjustPanel currentStock={product.stock ?? 0} onSubmit={handleStock} />
      </ScrollView>
    </>
  );
}
```

**Step 5：验证 & 提交**

Run: `npm run check`，Expected: PASS。

```bash
git add src/app/merchant/products/index.tsx \
        src/app/merchant/products/\[id\].tsx \
        src/components/merchant/MerchantProductCard.tsx \
        src/components/merchant/StockAdjustPanel.tsx
git commit -m "feat(merchant): 商品列表 / 详情 / 编辑与库存调整

背景：设计稿 §4.3 C 要求商家可改价 / 改描述 / 上下架 / 调库存；
MVP 不做新建商品（V2）。

改动：
- products/index.tsx 四段筛选（全部 / 已上架 / 已下架 / 低库存）+
  关键字搜索；列表卡片显示价格 / 库存 / 上架态，低库存加 ⚠️ 提示。
- products/[id].tsx 分两块：
  · 基本信息（name / price / description / is_active 开关），
    保存走 merchant_update_product 白名单 patch。
  · 库存调整面板 StockAdjustPanel，delta 可正可负，原因必填，
    走 merchant_update_stock，提交后回落当前库存最新值。
- 所有写操作错误统一 classifyMerchantError 展示中文 toast。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11：管理员授权页（admin 独享）+ 最终验收

**Files:**
- Create: `src/app/merchant/staff.tsx`（仅 admin 可见：按用户邮箱/id 授予或撤销角色）
- Modify: `src/app/merchant/_layout.tsx`（多挂一个 Tab "员工"，仅 admin）

**目标：** 补齐 `admin` 独有的"员工管理"入口，避免只能进数据库改表；并做一次端到端人工验收。

**Step 1：员工管理页**（`src/app/merchant/staff.tsx`）

```tsx
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { merchantRpc } from "@/lib/merchantRpc";
import { supabase } from "@/lib/supabase";

// admin 通过输入 user_id（或邮箱 → 查出 user_id）来授予或撤销角色。
// MVP 不做分页/搜索，保持最简单；后续如有需要可接入完整用户检索。
export default function MerchantStaffScreen() {
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (role: "admin" | "staff" | null) => {
    if (!userId.trim()) {
      Alert.alert("请先输入 user_id");
      return;
    }
    setBusy(true);
    try {
      await merchantRpc.grantRole(userId.trim(), role);
      Alert.alert(role ? `已设置为 ${role}` : "已撤销员工身份");
    } catch (err) {
      Alert.alert("操作失败", classifyMerchantError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppHeader title="员工管理" showBackButton />
      <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="text-on-surface-variant text-xs">
          仅 admin 可用。输入目标 Supabase user_id（auth.users.id UUID），
          再选择动作；操作会被写入 merchant_audit_logs。
        </Text>
        <TextInput
          value={userId}
          onChangeText={setUserId}
          placeholder="目标 user_id"
          className="border border-outline-variant rounded-lg px-3 py-2"
          autoCapitalize="none"
        />
        <View className="flex-row gap-3">
          <Pressable
            disabled={busy}
            onPress={() => call("staff")}
            className="flex-1 bg-primary rounded-lg py-3 items-center"
          >
            <Text className="text-white">设为 staff</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => call("admin")}
            className="flex-1 bg-primary rounded-lg py-3 items-center"
          >
            <Text className="text-white">设为 admin</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => call(null)}
            className="flex-1 border border-outline rounded-lg py-3 items-center"
          >
            <Text className="text-on-surface">撤销</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
```

**Step 2：`_layout` 按 admin 条件挂 Tab**

在 `src/app/merchant/_layout.tsx` 中追加（`role === "admin"` 才展示，否则 `href: null` 隐藏）：

```tsx
<Tabs.Screen
  name="staff"
  options={{
    title: "员工",
    href: role === "admin" ? undefined : null,
    tabBarIcon: ({ color, size }) => (
      <MaterialIcons name="badge" color={color} size={size} />
    ),
  }}
/>
```

> 注意：`role` 需要从 `useUserStore` 读出来；记得把前文的 `const role = useUserStore((s) => s.role);` 保留，不要在 Redirect 检查后又被遮蔽。

**Step 3：端到端人工验收清单**

在同一台设备 / 模拟器上依次跑：

1. **顾客态**：以普通账号登录 → `我的` 页无"商家后台"卡片；手动访问 `/merchant/orders` 应被重定向回首页。
2. **首次授权**：以 admin 账号（通过 SQL 直接 insert 到 `user_roles`，或其它 admin 通过员工管理页授权）登录 → 看到入口 → 进入后台。
3. **订单发货闭环**：找一笔 paid 订单 → 详情 → 发货弹窗 → 提交 → 状态变 shipping → 回列表看顺序与标签 → SQL 校验 `merchant_audit_logs` 多一条 `ship_order`。
4. **重复发货保护**：再点同一订单的发货按钮 → 应收到"操作与当前状态冲突"toast。
5. **售后流转**：造一条 pending 售后 → 同意（改金额） → 标记已打款（填 txn_id） → 审计表两条记录。
6. **拒绝售后**：另造一条 pending → 拒绝（必填理由） → 状态 rejected。
7. **商品编辑**：改某商品价格 + 关闭上架 → C 端商城看应下架 → 打开 → 再上架。
8. **库存调整**：+5 原因 "到货补入"；-3 原因 "质检出库"；stock 最终应 = 原值 + 2；审计表 2 条。
9. **非法 delta**：尝试提交 delta=0 → 前端禁用；尝试 -999（超过当前库存）→ 服务端 `greatest(0, ...)` 兜到 0，审计仍记录。
10. **权限越权**：staff 账号进 `/merchant/staff` 应看不到 Tab；直接贴 URL 跳过去，调 grantRole 会被 RPC 的 `is_admin()` 拦到 permission_denied。
11. **角色撤销**：admin 撤销某 staff → staff 再次打开 App，守卫会把 `/merchant/*` 重定向走。

每通过一条，在 `docs/plans/2026-04-17-merchant-console-plan.md` 末尾的"验收记录"追加一行（日期 + 结果）。

**Step 4：最终自检**

```bash
npm run check
```
Expected: lint + typecheck + test 全绿。

**Step 5：提交**

```bash
git add src/app/merchant/staff.tsx src/app/merchant/_layout.tsx \
        docs/plans/2026-04-17-merchant-console-plan.md
git commit -m "feat(merchant): admin 员工管理页 + 端到端验收清单

背景：MVP 收尾，需要让 admin 能自助给同事加入/撤销员工身份，
避免被迫操作数据库；同时把端到端验收路径沉淀到计划文档，便于
日后回归。

改动：
- merchant/staff.tsx：输入 user_id → 设为 staff / admin / 撤销；
  全部通过 merchant_grant_role（函数内 is_admin() 双保险）。
- merchant/_layout.tsx 新增「员工」Tab，href 按 role==='admin'
  动态切换，非 admin 完全不可见。
- 计划文档 §Task 11 新增 11 条人工验收路径并留下验收记录区。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 验收记录

> 实施时在此追加每次回归结果，格式：`YYYY-MM-DD · 验收人 · 场景 · 结果`。

- 待填

---

## 后续（V2 排期建议，明确 *不在本计划范围内*）

按设计稿 §8 列的延期清单落盘；执行任何一项前都应重新走 brainstorming → writing-plans。

- 线下门店扫码核销（依赖扫码模块 + 订单与门店多对多）
- 社区 / 评论审核
- 优惠券 / 积分任务可视化配置
- 商家端推送发放配置 UI
- 数据看板（销售 / 转化 / 热销 TOP N）
- 新建商品（含图片上传、SKU 配置、多规格）
- 支付宝退款 API 自动打款
- 细粒度角色（ops / cs / warehouse）+ 权限矩阵

