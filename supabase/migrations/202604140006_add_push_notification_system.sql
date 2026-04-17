-- 推送通知系统 V1：新增设备注册、偏好、推送队列、投递日志，以及社区互动通知与推送队列触发器。

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  expo_push_token text not null,
  device_name text,
  app_version text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.push_devices is '推送设备表：保存用户设备与 Expo push token。';

create unique index if not exists uq_push_devices_expo_push_token
  on public.push_devices (expo_push_token);
create index if not exists idx_push_devices_user_id_is_active
  on public.push_devices (user_id, is_active, updated_at desc);

create table if not exists public.push_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  order_enabled boolean not null default true,
  after_sale_enabled boolean not null default true,
  community_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.push_preferences is '推送偏好表：保存用户的总开关与分类级推送偏好。';

create table if not exists public.push_dispatch_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  push_type text not null check (push_type in ('order', 'after_sale', 'community')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  last_error text,
  scheduled_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.push_dispatch_queue is '推送分发队列表：保存待发送与已处理的推送任务。';

create unique index if not exists uq_push_dispatch_queue_notification_id
  on public.push_dispatch_queue (notification_id);
create index if not exists idx_push_dispatch_queue_status_scheduled_at
  on public.push_dispatch_queue (status, scheduled_at asc, created_at asc);

create table if not exists public.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.push_dispatch_queue(id) on delete cascade,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  expo_push_token text not null,
  ticket_id text,
  status text not null check (status in ('ok', 'error', 'skipped')),
  error_code text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.push_delivery_logs is '推送投递日志：记录每台设备每次发送的结果，便于排查送达率和失败原因。';

create index if not exists idx_push_delivery_logs_queue_id_created_at
  on public.push_delivery_logs (queue_id, created_at desc);
create index if not exists idx_push_delivery_logs_device_id_created_at
  on public.push_delivery_logs (device_id, created_at desc);

drop trigger if exists set_push_devices_updated_at on public.push_devices;
create trigger set_push_devices_updated_at
before update on public.push_devices
for each row
execute function public.set_updated_at();

drop trigger if exists set_push_preferences_updated_at on public.push_preferences;
create trigger set_push_preferences_updated_at
before update on public.push_preferences
for each row
execute function public.set_updated_at();

drop trigger if exists set_push_dispatch_queue_updated_at on public.push_dispatch_queue;
create trigger set_push_dispatch_queue_updated_at
before update on public.push_dispatch_queue
for each row
execute function public.set_updated_at();

alter table public.push_devices enable row level security;
alter table public.push_preferences enable row level security;
alter table public.push_dispatch_queue enable row level security;
alter table public.push_delivery_logs enable row level security;

do $push_devices_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_devices'
      and policyname = 'Users can read own push devices'
  ) then
    create policy "Users can read own push devices"
    on public.push_devices
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_devices'
      and policyname = 'Users can manage own push devices'
  ) then
    create policy "Users can manage own push devices"
    on public.push_devices
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$push_devices_policies$;

do $push_preferences_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_preferences'
      and policyname = 'Users can read own push preferences'
  ) then
    create policy "Users can read own push preferences"
    on public.push_preferences
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_preferences'
      and policyname = 'Users can manage own push preferences'
  ) then
    create policy "Users can manage own push preferences"
    on public.push_preferences
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$push_preferences_policies$;

comment on policy "Users can read own push devices" on public.push_devices is '仅允许登录用户读取自己的推送设备记录。';
comment on policy "Users can manage own push devices" on public.push_devices is '仅允许登录用户维护自己的推送设备记录。';
comment on policy "Users can read own push preferences" on public.push_preferences is '仅允许登录用户读取自己的推送偏好。';
comment on policy "Users can manage own push preferences" on public.push_preferences is '仅允许登录用户维护自己的推送偏好。';

create or replace function public.resolve_push_type_from_notification(
  p_type text,
  p_related_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type = 'community' then
    return 'community';
  end if;

  if p_type = 'order' and p_related_type = 'after_sale_request' then
    return 'after_sale';
  end if;

  if p_type = 'order' then
    return 'order';
  end if;

  return null;
end;
$$;

comment on function public.resolve_push_type_from_notification(text, text) is '根据站内通知类型与关联资源类型解析推送分类。';

create or replace function public.handle_notification_push_queue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_push_type text;
begin
  v_push_type := public.resolve_push_type_from_notification(new.type, new.related_type);

  if v_push_type is null then
    return new;
  end if;

  insert into public.push_dispatch_queue (
    notification_id,
    user_id,
    push_type,
    payload
  ) values (
    new.id,
    new.user_id,
    v_push_type,
    jsonb_build_object(
      'title', new.title,
      'body', new.message,
      'notificationId', new.id,
      'relatedType', new.related_type,
      'relatedId', new.related_id,
      'type', new.type
    )
  )
  on conflict (notification_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_notification_push_queue() is '当可推送通知写入时，自动将其放入推送分发队列。';

drop trigger if exists trg_notification_push_queue on public.notifications;
create trigger trg_notification_push_queue
after insert on public.notifications
for each row
execute function public.handle_notification_push_queue();

comment on trigger trg_notification_push_queue on public.notifications is '通知创建后自动入推送分发队列。';

create or replace function public.handle_post_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author_id uuid;
  commenter_name text;
  post_title text;
begin
  select p.author_id,
         coalesce(nullif(p.title, ''), nullif(p.caption, ''), '你的帖子')
    into post_author_id, post_title
  from public.posts p
  where p.id = new.post_id;

  if post_author_id is null or post_author_id = new.author_id then
    return new;
  end if;

  select coalesce(nullif(pr.name, ''), '茶友') into commenter_name
  from public.profiles pr
  where pr.id = new.author_id;

  perform public.create_notification(
    post_author_id,
    'community',
    '收到新评论',
    commenter_name || ' 评论了你的帖子「' || coalesce(post_title, '你的帖子') || '」。',
    'post',
    new.post_id,
    jsonb_build_object(
      'post_id', new.post_id,
      'comment_id', new.id,
      'action', 'comment'
    )
  );

  return new;
end;
$$;

comment on function public.handle_post_comment_notification() is '社区评论创建后为帖子作者生成一条社区互动通知。';

create or replace function public.handle_post_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author_id uuid;
  liker_name text;
  post_title text;
begin
  select p.author_id,
         coalesce(nullif(p.title, ''), nullif(p.caption, ''), '你的帖子')
    into post_author_id, post_title
  from public.posts p
  where p.id = new.post_id;

  if post_author_id is null or post_author_id = new.user_id then
    return new;
  end if;

  select coalesce(nullif(pr.name, ''), '茶友') into liker_name
  from public.profiles pr
  where pr.id = new.user_id;

  perform public.create_notification(
    post_author_id,
    'community',
    '收到新点赞',
    liker_name || ' 点赞了你的帖子「' || coalesce(post_title, '你的帖子') || '」。',
    'post',
    new.post_id,
    jsonb_build_object(
      'post_id', new.post_id,
      'action', 'post_like'
    )
  );

  return new;
end;
$$;

comment on function public.handle_post_like_notification() is '帖子被点赞后为作者生成一条社区互动通知。';

create or replace function public.handle_comment_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  comment_author_id uuid;
  post_id uuid;
  liker_name text;
begin
  select c.author_id, c.post_id
    into comment_author_id, post_id
  from public.post_comments c
  where c.id = new.comment_id;

  if comment_author_id is null or comment_author_id = new.user_id then
    return new;
  end if;

  select coalesce(nullif(pr.name, ''), '茶友') into liker_name
  from public.profiles pr
  where pr.id = new.user_id;

  perform public.create_notification(
    comment_author_id,
    'community',
    '评论收到点赞',
    liker_name || ' 点赞了你的评论。',
    'post',
    post_id,
    jsonb_build_object(
      'post_id', post_id,
      'comment_id', new.comment_id,
      'action', 'comment_like'
    )
  );

  return new;
end;
$$;

comment on function public.handle_comment_like_notification() is '评论被点赞后为评论作者生成一条社区互动通知。';

create or replace function public.handle_post_bookmark_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author_id uuid;
  bookmark_user_name text;
  post_title text;
begin
  select p.author_id,
         coalesce(nullif(p.title, ''), nullif(p.caption, ''), '你的帖子')
    into post_author_id, post_title
  from public.posts p
  where p.id = new.post_id;

  if post_author_id is null or post_author_id = new.user_id then
    return new;
  end if;

  select coalesce(nullif(pr.name, ''), '茶友') into bookmark_user_name
  from public.profiles pr
  where pr.id = new.user_id;

  perform public.create_notification(
    post_author_id,
    'community',
    '帖子被收藏',
    bookmark_user_name || ' 收藏了你的帖子「' || coalesce(post_title, '你的帖子') || '」。',
    'post',
    new.post_id,
    jsonb_build_object(
      'post_id', new.post_id,
      'action', 'post_bookmark'
    )
  );

  return new;
end;
$$;

comment on function public.handle_post_bookmark_notification() is '帖子被收藏后为作者生成一条社区互动通知。';

drop trigger if exists trg_post_comment_notification on public.post_comments;
create trigger trg_post_comment_notification
after insert on public.post_comments
for each row
execute function public.handle_post_comment_notification();

drop trigger if exists trg_post_like_notification on public.post_likes;
create trigger trg_post_like_notification
after insert on public.post_likes
for each row
execute function public.handle_post_like_notification();

drop trigger if exists trg_comment_like_notification on public.comment_likes;
create trigger trg_comment_like_notification
after insert on public.comment_likes
for each row
execute function public.handle_comment_like_notification();

drop trigger if exists trg_post_bookmark_notification on public.post_bookmarks;
create trigger trg_post_bookmark_notification
after insert on public.post_bookmarks
for each row
execute function public.handle_post_bookmark_notification();

comment on trigger trg_post_comment_notification on public.post_comments is '评论创建后自动生成社区互动通知。';
comment on trigger trg_post_like_notification on public.post_likes is '帖子点赞后自动生成社区互动通知。';
comment on trigger trg_comment_like_notification on public.comment_likes is '评论点赞后自动生成社区互动通知。';
comment on trigger trg_post_bookmark_notification on public.post_bookmarks is '帖子收藏后自动生成社区互动通知。';
