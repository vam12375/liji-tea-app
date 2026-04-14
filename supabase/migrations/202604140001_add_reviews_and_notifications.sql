-- 新增评价与通知基础能力：包含商品评价表、通知表、评价后自动通知触发器，以及对应索引与 RLS 策略。

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

comment on function public.set_updated_at() is '通用更新时间触发器函数：在记录更新时自动回写 updated_at。';

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  content text,
  tags text[] not null default '{}',
  images text[] not null default '{}',
  is_anonymous boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint product_reviews_unique_order_item unique (order_item_id),
  constraint product_reviews_order_item_match check (array_length(images, 1) is null or array_length(images, 1) <= 6)
);

comment on table public.product_reviews is '商品评价表，记录用户对订单商品的评分、评价内容、标签与晒单图片。';
comment on column public.product_reviews.id is '商品评价主键。';
comment on column public.product_reviews.product_id is '被评价商品 ID。';
comment on column public.product_reviews.order_id is '关联订单 ID。';
comment on column public.product_reviews.order_item_id is '关联订单项 ID，确保每个订单项仅评价一次。';
comment on column public.product_reviews.user_id is '评价用户 ID。';
comment on column public.product_reviews.rating is '商品评分，范围 1 到 5。';
comment on column public.product_reviews.content is '评价正文内容。';
comment on column public.product_reviews.tags is '评价标签列表。';
comment on column public.product_reviews.images is '晒单图片地址列表。';
comment on column public.product_reviews.is_anonymous is '是否匿名评价。';
comment on column public.product_reviews.created_at is '评价创建时间。';
comment on column public.product_reviews.updated_at is '评价最近更新时间。';

alter table public.product_reviews add column if not exists product_id uuid references public.products(id) on delete cascade;
alter table public.product_reviews add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.product_reviews add column if not exists order_item_id uuid references public.order_items(id) on delete cascade;
alter table public.product_reviews add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.product_reviews add column if not exists rating integer;
alter table public.product_reviews add column if not exists content text;
alter table public.product_reviews add column if not exists tags text[];
alter table public.product_reviews add column if not exists images text[];
alter table public.product_reviews add column if not exists is_anonymous boolean;
alter table public.product_reviews add column if not exists created_at timestamptz;
alter table public.product_reviews add column if not exists updated_at timestamptz;

update public.product_reviews
set tags = coalesce(tags, '{}'),
    images = coalesce(images, '{}'),
    is_anonymous = coalesce(is_anonymous, false),
    created_at = coalesce(created_at, timezone('utc', now())),
    updated_at = coalesce(updated_at, timezone('utc', now()))
where true;

alter table public.product_reviews alter column tags set default '{}';
alter table public.product_reviews alter column images set default '{}';
alter table public.product_reviews alter column is_anonymous set default false;
alter table public.product_reviews alter column created_at set default timezone('utc', now());
alter table public.product_reviews alter column updated_at set default timezone('utc', now());

create index if not exists idx_product_reviews_product_id_created_at
  on public.product_reviews (product_id, created_at desc);
create index if not exists idx_product_reviews_user_id_created_at
  on public.product_reviews (user_id, created_at desc);
create index if not exists idx_product_reviews_order_id
  on public.product_reviews (order_id);

comment on index public.idx_product_reviews_product_id_created_at is '支持按商品和时间倒序查询评价列表。';
comment on index public.idx_product_reviews_user_id_created_at is '支持按用户和时间倒序查询历史评价。';
comment on index public.idx_product_reviews_order_id is '支持按订单定位评价记录。';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('order', 'system', 'community', 'review')),
  title text not null,
  message text not null,
  related_type text,
  related_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.notifications is '消息通知表，记录订单、系统、社区、评价等业务通知。';
comment on column public.notifications.id is '通知主键。';
comment on column public.notifications.user_id is '通知接收用户 ID。';
comment on column public.notifications.type is '通知分类，例如 order、system、community、review。';
comment on column public.notifications.title is '通知标题。';
comment on column public.notifications.message is '通知正文。';
comment on column public.notifications.related_type is '通知关联资源类型，例如 order、post、product_review。';
comment on column public.notifications.related_id is '通知关联资源 ID。';
comment on column public.notifications.metadata is '通知扩展元数据。';
comment on column public.notifications.is_read is '通知是否已读。';
comment on column public.notifications.created_at is '通知创建时间。';
comment on column public.notifications.updated_at is '通知最近更新时间。';

alter table public.notifications add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists related_type text;
alter table public.notifications add column if not exists related_id uuid;
alter table public.notifications add column if not exists metadata jsonb;
alter table public.notifications add column if not exists is_read boolean;
alter table public.notifications add column if not exists created_at timestamptz;
alter table public.notifications add column if not exists updated_at timestamptz;

update public.notifications
set metadata = coalesce(metadata, '{}'::jsonb),
    is_read = coalesce(is_read, false),
    created_at = coalesce(created_at, timezone('utc', now())),
    updated_at = coalesce(updated_at, timezone('utc', now()))
where true;

alter table public.notifications alter column metadata set default '{}'::jsonb;
alter table public.notifications alter column is_read set default false;
alter table public.notifications alter column created_at set default timezone('utc', now());
alter table public.notifications alter column updated_at set default timezone('utc', now());

create index if not exists idx_notifications_user_id_created_at
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_id_is_read
  on public.notifications (user_id, is_read, created_at desc);

comment on index public.idx_notifications_user_id_created_at is '支持按用户和时间倒序查询通知列表。';
comment on index public.idx_notifications_user_id_is_read is '支持按用户与已读状态筛选通知。';

create or replace function public.handle_product_review_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_owner uuid;
  reviewer_name text;
  product_name text;
begin
  select o.user_id into order_owner
  from public.orders o
  where o.id = new.order_id;

  if order_owner is null then
    return new;
  end if;

  select coalesce(nullif(p.name, ''), '你的商品') into product_name
  from public.products p
  where p.id = new.product_id;

  select coalesce(nullif(pr.name, ''), '茶友') into reviewer_name
  from public.profiles pr
  where pr.id = new.user_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    related_type,
    related_id,
    metadata
  ) values (
    order_owner,
    'review',
    '评价已提交',
    reviewer_name || ' 已完成对「' || coalesce(product_name, '商品') || '」的评价。',
    'product_review',
    new.id,
    jsonb_build_object(
      'product_id', new.product_id,
      'order_id', new.order_id,
      'order_item_id', new.order_item_id,
      'rating', new.rating
    )
  );

  return new;
end;
$$;

comment on function public.handle_product_review_notification() is '当用户提交商品评价后，自动为相关用户生成一条评价通知。';

drop trigger if exists trg_product_review_notification on public.product_reviews;
create trigger trg_product_review_notification
after insert on public.product_reviews
for each row
execute function public.handle_product_review_notification();

comment on trigger trg_product_review_notification on public.product_reviews is '评价创建后自动写入评价通知。';

drop trigger if exists set_product_reviews_updated_at on public.product_reviews;
create trigger set_product_reviews_updated_at
before update on public.product_reviews
for each row
execute function public.set_updated_at();

comment on trigger set_product_reviews_updated_at on public.product_reviews is '商品评价更新前自动刷新 updated_at。';

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row
execute function public.set_updated_at();

comment on trigger set_notifications_updated_at on public.notifications is '通知更新前自动刷新 updated_at。';

alter table public.product_reviews enable row level security;
alter table public.notifications enable row level security;

do $product_reviews_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_reviews' and policyname = 'Users can read published reviews'
  ) then
    create policy "Users can read published reviews"
    on public.product_reviews
    for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_reviews' and policyname = 'Users can insert own reviews'
  ) then
    create policy "Users can insert own reviews"
    on public.product_reviews
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_reviews' and policyname = 'Users can update own reviews'
  ) then
    create policy "Users can update own reviews"
    on public.product_reviews
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$product_reviews_policies$;

comment on policy "Users can read published reviews" on public.product_reviews is '允许登录用户读取商品评价内容。';
comment on policy "Users can insert own reviews" on public.product_reviews is '仅允许登录用户创建自己的商品评价。';
comment on policy "Users can update own reviews" on public.product_reviews is '仅允许登录用户更新自己的商品评价。';

do $notifications_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can read own notifications'
  ) then
    create policy "Users can read own notifications"
    on public.notifications
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can update own notifications'
  ) then
    create policy "Users can update own notifications"
    on public.notifications
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$notifications_policies$;

comment on policy "Users can read own notifications" on public.notifications is '仅允许登录用户读取自己的通知记录。';
comment on policy "Users can update own notifications" on public.notifications is '仅允许登录用户更新自己的通知已读状态等字段。';