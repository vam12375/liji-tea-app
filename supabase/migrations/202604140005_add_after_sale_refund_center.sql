-- 售后 / 退款中心 V1：新增独立售后域、订单退款快照、通知触发器与凭证存储策略。

create extension if not exists pgcrypto;

create table if not exists public.after_sale_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null default 'refund' check (request_type in ('refund')),
  scope_type text not null default 'order' check (scope_type in ('order')),
  status text not null check (
    status in (
      'submitted',
      'auto_approved',
      'pending_review',
      'approved',
      'rejected',
      'refunding',
      'refunded',
      'cancelled'
    )
  ),
  reason_code text not null,
  reason_text text,
  requested_amount numeric(10,2) not null check (requested_amount >= 0),
  approved_amount numeric(10,2) check (approved_amount >= 0),
  currency text not null default 'CNY',
  audit_note text,
  refund_note text,
  snapshot jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  refunded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.after_sale_requests is '售后申请表：当前 V1 仅承载整单退款申请。';
comment on column public.after_sale_requests.order_id is '关联订单 ID。';
comment on column public.after_sale_requests.user_id is '申请用户 ID。';
comment on column public.after_sale_requests.request_type is '售后类型，V1 固定为 refund。';
comment on column public.after_sale_requests.scope_type is '售后粒度，V1 固定为整单 order。';
comment on column public.after_sale_requests.status is '售后状态机当前节点。';
comment on column public.after_sale_requests.reason_code is '退款原因编码。';
comment on column public.after_sale_requests.reason_text is '用户补充说明。';
comment on column public.after_sale_requests.requested_amount is '用户申请退款金额。';
comment on column public.after_sale_requests.approved_amount is '审核通过或最终退款金额。';
comment on column public.after_sale_requests.snapshot is '下单金额、商品摘要、支付方式等快照，避免后续历史信息漂移。';

create table if not exists public.after_sale_evidences (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.after_sale_requests(id) on delete cascade,
  file_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.after_sale_evidences is '售后凭证表：记录退款申请关联的图片凭证路径。';
comment on column public.after_sale_evidences.file_url is 'Storage 文件路径。';

create index if not exists idx_after_sale_requests_user_id_created_at
  on public.after_sale_requests (user_id, created_at desc);
create index if not exists idx_after_sale_requests_order_id_created_at
  on public.after_sale_requests (order_id, created_at desc);
create index if not exists idx_after_sale_requests_status_created_at
  on public.after_sale_requests (status, created_at desc);
create index if not exists idx_after_sale_evidences_request_id_sort_order
  on public.after_sale_evidences (request_id, sort_order asc, created_at asc);

create unique index if not exists uq_after_sale_requests_active_order
  on public.after_sale_requests (order_id)
  where status in ('submitted', 'auto_approved', 'pending_review', 'approved', 'refunding');

alter table public.orders
  add column if not exists after_sale_status text,
  add column if not exists refund_status text,
  add column if not exists refund_amount numeric(10,2),
  add column if not exists refunded_at timestamptz;

comment on column public.orders.after_sale_status is '订单最近一次售后状态快照，便于列表与详情快速展示。';
comment on column public.orders.refund_status is '订单退款状态快照，如 refunding / refunded。';
comment on column public.orders.refund_amount is '订单最近一次售后确认的退款金额。';
comment on column public.orders.refunded_at is '订单最近一次退款完成时间。';

create or replace function public.sync_order_after_sale_snapshot(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_after_sale_status text;
  v_refund_status text;
  v_refund_amount numeric(10,2);
  v_refunded_at timestamptz;
begin
  select
    status,
    coalesce(approved_amount, requested_amount) as refund_amount,
    refunded_at
  into v_request
  from public.after_sale_requests
  where order_id = p_order_id
  order by created_at desc, updated_at desc
  limit 1;

  if not found then
    update public.orders
    set
      after_sale_status = null,
      refund_status = null,
      refund_amount = null,
      refunded_at = null
    where id = p_order_id;

    return;
  end if;

  v_after_sale_status := v_request.status;
  v_refund_status := case
    when v_request.status in ('auto_approved', 'approved', 'refunding') then 'refunding'
    when v_request.status = 'refunded' then 'refunded'
    else null
  end;
  v_refund_amount := case
    when v_request.status in ('auto_approved', 'approved', 'refunding', 'refunded')
      then v_request.refund_amount
    else null
  end;
  v_refunded_at := case
    when v_request.status = 'refunded' then v_request.refunded_at
    else null
  end;

  update public.orders
  set
    after_sale_status = v_after_sale_status,
    refund_status = v_refund_status,
    refund_amount = v_refund_amount,
    refunded_at = v_refunded_at,
    status = case
      when v_request.status = 'refunded' then 'cancelled'
      else status
    end
  where id = p_order_id;
end;
$$;

comment on function public.sync_order_after_sale_snapshot(uuid) is '根据售后申请的最新状态回写订单退款快照字段。';

create or replace function public.get_after_sale_notification_payload(p_request public.after_sale_requests)
returns table (
  title text,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  case p_request.status
    when 'submitted' then
      return query select '退款申请已提交', '退款申请已提交，请等待系统处理。';
    when 'auto_approved' then
      return query select '退款申请已自动通过', '订单符合自动退款条件，系统已进入退款处理阶段。';
    when 'pending_review' then
      return query select '退款申请待审核', '退款申请已进入人工审核，请留意后续结果。';
    when 'approved' then
      return query select '退款申请审核通过', '退款申请审核通过，正在处理退款。';
    when 'rejected' then
      return query select '退款申请未通过', '退款申请未通过，请查看审核说明。';
    when 'refunding' then
      return query select '退款处理中', '退款申请正在处理，请注意查收结果。';
    when 'refunded' then
      return query select '退款已完成', '退款已完成，请注意查收。';
    when 'cancelled' then
      return query select '退款申请已撤销', '退款申请已撤销。';
    else
      return query select '售后状态已更新', '售后状态已发生变更。';
  end case;
end;
$$;

comment on function public.get_after_sale_notification_payload(public.after_sale_requests) is '根据售后状态生成对应的站内消息标题与正文。';

create or replace function public.handle_after_sale_request_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload record;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select * into v_payload
  from public.get_after_sale_notification_payload(new);

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    related_type,
    related_id,
    metadata
  ) values (
    new.user_id,
    'order',
    coalesce(v_payload.title, '售后状态已更新'),
    coalesce(v_payload.message, '售后状态已发生变更。'),
    'after_sale_request',
    new.id,
    jsonb_build_object(
      'after_sale_request_id', new.id,
      'order_id', new.order_id,
      'after_sale_status', new.status,
      'refund_amount', coalesce(new.approved_amount, new.requested_amount)
    )
  );

  return new;
end;
$$;

comment on function public.handle_after_sale_request_updated() is '售后状态更新后自动写入订单类站内通知。';

create or replace function public.handle_after_sale_request_order_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_order_after_sale_snapshot(old.order_id);
    return old;
  end if;

  perform public.sync_order_after_sale_snapshot(new.order_id);
  return coalesce(new, old);
end;
$$;

comment on function public.handle_after_sale_request_order_sync() is '售后申请增删改后统一回写订单退款快照字段。';

drop trigger if exists set_after_sale_requests_updated_at on public.after_sale_requests;
create trigger set_after_sale_requests_updated_at
before update on public.after_sale_requests
for each row
execute function public.set_updated_at();

drop trigger if exists trg_after_sale_request_updated_notification on public.after_sale_requests;
create trigger trg_after_sale_request_updated_notification
after update on public.after_sale_requests
for each row
execute function public.handle_after_sale_request_updated();

drop trigger if exists trg_after_sale_request_order_sync on public.after_sale_requests;
create trigger trg_after_sale_request_order_sync
after insert or update or delete on public.after_sale_requests
for each row
execute function public.handle_after_sale_request_order_sync();

alter table public.after_sale_requests enable row level security;
alter table public.after_sale_evidences enable row level security;

do $after_sale_requests_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'after_sale_requests'
      and policyname = 'Users can read own after sale requests'
  ) then
    create policy "Users can read own after sale requests"
    on public.after_sale_requests
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$after_sale_requests_policies$;

do $after_sale_evidences_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'after_sale_evidences'
      and policyname = 'Users can read own after sale evidences'
  ) then
    create policy "Users can read own after sale evidences"
    on public.after_sale_evidences
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.after_sale_requests r
        where r.id = after_sale_evidences.request_id
          and r.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'after_sale_evidences'
      and policyname = 'Users can insert own after sale evidences'
  ) then
    create policy "Users can insert own after sale evidences"
    on public.after_sale_evidences
    for insert
    to authenticated
    with check (
      exists (
        select 1
        from public.after_sale_requests r
        where r.id = after_sale_evidences.request_id
          and r.user_id = auth.uid()
      )
    );
  end if;
end
$after_sale_evidences_policies$;

comment on policy "Users can read own after sale requests" on public.after_sale_requests is '仅允许登录用户读取自己的售后申请。';
comment on policy "Users can read own after sale evidences" on public.after_sale_evidences is '仅允许登录用户读取自己售后申请下的凭证。';
comment on policy "Users can insert own after sale evidences" on public.after_sale_evidences is '仅允许登录用户为自己的售后申请追加凭证。';

insert into storage.buckets (id, name, public)
values ('after-sale-evidences', 'after-sale-evidences', false)
on conflict (id) do nothing;

drop policy if exists "After sale evidences read" on storage.objects;
create policy "After sale evidences read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'after-sale-evidences'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "After sale evidences upload" on storage.objects;
create policy "After sale evidences upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'after-sale-evidences'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "After sale evidences update" on storage.objects;
create policy "After sale evidences update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'after-sale-evidences'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'after-sale-evidences'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "After sale evidences delete" on storage.objects;
create policy "After sale evidences delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'after-sale-evidences'
  and auth.uid()::text = (storage.foldername(name))[1]
);
