-- 启用生成 UUID 所需的扩展，供文章、社区等业务表主键复用。
create extension if not exists pgcrypto;
comment on extension pgcrypto is '提供加密与随机值能力，本迁移主要用于生成 UUID 主键。';

-- 通用更新时间触发器函数：在行更新时自动回写 `updated_at`。

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- 用户档案表：与 `auth.users` 一一对应，存储昵称、头像、会员信息等资料。
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text unique,
  avatar_url text,
  bio text,
  member_tier text not null default '新叶会员',
  points integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 兼容已存在的旧版 `profiles` 表：若历史环境缺少新增字段，则在此补齐，避免后续注释、触发器或前端读写失败。
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists member_tier text;
alter table public.profiles add column if not exists points integer;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz;

update public.profiles
set member_tier = coalesce(member_tier, '新叶会员'),
    points = coalesce(points, 0),
    created_at = coalesce(created_at, timezone('utc', now())),
    updated_at = coalesce(updated_at, timezone('utc', now()));

alter table public.profiles alter column member_tier set default '新叶会员';
alter table public.profiles alter column points set default 0;
alter table public.profiles alter column created_at set default timezone('utc', now());
alter table public.profiles alter column updated_at set default timezone('utc', now());
alter table public.profiles alter column member_tier set not null;
alter table public.profiles alter column points set not null;
alter table public.profiles alter column created_at set not null;
alter table public.profiles alter column updated_at set not null;

-- 新用户注册后自动补齐 `profiles` 记录，保证业务层始终能关联到档案信息。

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '茶友' || right(coalesce(new.phone, new.id::text), 4)
    ),
    new.phone,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set phone = excluded.phone,
        name = coalesce(public.profiles.name, excluded.name),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
        updated_at = timezone('utc', now());

  return new;
end;
$$;

-- 尝试为鉴权用户表补齐注册后自动建档触发器；若当前执行角色不是 `auth.users` 的 owner，则跳过并给出 notice，避免整份迁移失败。
do $auth_trigger$
begin
  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'on_auth_user_created'
      and n.nspname = 'auth'
      and c.relname = 'users'
      and not t.tgisinternal
  ) then
    begin
      execute $sql$comment on trigger on_auth_user_created on auth.users is '认证用户创建后自动同步生成业务档案。'$sql$;
    exception
      when insufficient_privilege then
        raise notice '跳过 auth.users 既有触发器注释：当前角色不是 auth.users 的 owner。';
    end;
  else
    begin
      execute $sql$create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()$sql$;
      execute $sql$comment on trigger on_auth_user_created on auth.users is '认证用户创建后自动同步生成业务档案。'$sql$;
    exception
      when insufficient_privilege then
        raise notice '跳过创建 auth.users 触发器：当前角色不是 auth.users 的 owner，请改用具备权限的角色单独执行。';
    end;
  end if;
end
$auth_trigger$;


-- 文章表：存储茶道内容、封面、正文 JSON、发布时间等信息。

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  subtitle text,
  category text not null,
  image_url text,
  read_time text,
  date text,
  content jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 兼容已存在的旧版 `articles` 表：若历史环境缺少新增字段，则在此补齐。
alter table public.articles add column if not exists slug text;
alter table public.articles add column if not exists subtitle text;
alter table public.articles add column if not exists read_time text;
alter table public.articles add column if not exists date text;
alter table public.articles add column if not exists content jsonb;
alter table public.articles add column if not exists is_featured boolean;
alter table public.articles add column if not exists is_published boolean;
alter table public.articles add column if not exists published_at timestamptz;
alter table public.articles add column if not exists created_at timestamptz;
alter table public.articles add column if not exists updated_at timestamptz;

update public.articles
set content = coalesce(content, '[]'::jsonb),
    is_featured = coalesce(is_featured, false),
    is_published = coalesce(is_published, true),
    published_at = coalesce(published_at, timezone('utc', now())),
    created_at = coalesce(created_at, timezone('utc', now())),
    updated_at = coalesce(updated_at, timezone('utc', now()));

alter table public.articles alter column content set default '[]'::jsonb;
alter table public.articles alter column is_featured set default false;
alter table public.articles alter column is_published set default true;
alter table public.articles alter column published_at set default timezone('utc', now());
alter table public.articles alter column created_at set default timezone('utc', now());
alter table public.articles alter column updated_at set default timezone('utc', now());
alter table public.articles alter column content set not null;
alter table public.articles alter column is_featured set not null;
alter table public.articles alter column is_published set not null;
alter table public.articles alter column published_at set not null;
alter table public.articles alter column created_at set not null;
alter table public.articles alter column updated_at set not null;
create unique index if not exists idx_articles_slug_unique on public.articles (slug) where slug is not null;

-- 时令茶单表：用于社区首页 / 茶道页展示精选内容。
create table if not exists public.seasonal_picks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 兼容已存在的旧版 `seasonal_picks` 表：补齐排序、启用状态与时间字段。
alter table public.seasonal_picks add column if not exists description text;
alter table public.seasonal_picks add column if not exists image_url text;
alter table public.seasonal_picks add column if not exists is_active boolean;
alter table public.seasonal_picks add column if not exists sort_order integer;
alter table public.seasonal_picks add column if not exists created_at timestamptz;
alter table public.seasonal_picks add column if not exists updated_at timestamptz;

update public.seasonal_picks
set is_active = coalesce(is_active, true),
    sort_order = coalesce(sort_order, 0),
    created_at = coalesce(created_at, timezone('utc', now())),
    updated_at = coalesce(updated_at, timezone('utc', now()));

alter table public.seasonal_picks alter column is_active set default true;
alter table public.seasonal_picks alter column sort_order set default 0;
alter table public.seasonal_picks alter column created_at set default timezone('utc', now());
alter table public.seasonal_picks alter column updated_at set default timezone('utc', now());
alter table public.seasonal_picks alter column is_active set not null;
alter table public.seasonal_picks alter column sort_order set not null;
alter table public.seasonal_picks alter column created_at set not null;
alter table public.seasonal_picks alter column updated_at set not null;

-- 社区帖子表：承载晒图、冲泡记录、问答内容，以及互动计数字段。
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('photo', 'brewing', 'question')),
  location text,
  image_url text,
  caption text,
  tea_name text,
  brewing_data jsonb,
  brewing_images text[] not null default '{}',
  quote text,
  title text,
  description text,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 兼容已存在的旧版 `posts` 表：补齐社区互动与多内容类型字段，并将历史命名迁移到当前结构。
alter table public.posts add column if not exists author_id uuid references public.profiles(id) on delete cascade;
alter table public.posts add column if not exists location text;
alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists caption text;
alter table public.posts add column if not exists tea_name text;
alter table public.posts add column if not exists brewing_data jsonb;
alter table public.posts add column if not exists brewing_images text[];
alter table public.posts add column if not exists quote text;
alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists description text;
alter table public.posts add column if not exists like_count integer;
alter table public.posts add column if not exists comment_count integer;
alter table public.posts add column if not exists created_at timestamptz;
alter table public.posts add column if not exists updated_at timestamptz;

do $posts_legacy_columns$
declare
  has_user_id boolean;
  has_likes boolean;
  has_comments boolean;
  has_answer_count boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'likes'
  ) into has_likes;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'comments'
  ) into has_comments;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'answer_count'
  ) into has_answer_count;

  if has_user_id then
    execute $sql$
      update public.posts
      set author_id = coalesce(author_id, user_id)
      where author_id is null
        and user_id is not null
    $sql$;
  end if;

  if has_likes then
    execute $sql$
      update public.posts
      set like_count = coalesce(like_count, likes, 0)
      where like_count is null
    $sql$;
  else
    update public.posts
    set like_count = 0
    where like_count is null;
  end if;

  if has_comments and has_answer_count then
    execute $sql$
      update public.posts
      set comment_count = coalesce(comment_count, comments, answer_count, 0)
      where comment_count is null
    $sql$;
  elsif has_comments then
    execute $sql$
      update public.posts
      set comment_count = coalesce(comment_count, comments, 0)
      where comment_count is null
    $sql$;
  elsif has_answer_count then
    execute $sql$
      update public.posts
      set comment_count = coalesce(comment_count, answer_count, 0)
      where comment_count is null
    $sql$;
  else
    update public.posts
    set comment_count = 0
    where comment_count is null;
  end if;

  update public.posts
  set created_at = coalesce(created_at, timezone('utc', now())),
      updated_at = coalesce(updated_at, created_at, timezone('utc', now()))
  where created_at is null
     or updated_at is null;
end
$posts_legacy_columns$;

-- 兼容历史环境中 `brewing_images` 可能被建成 `json/jsonb/text` 的情况，统一转换为前端当前使用的 `text[]`。
do $posts_brewing_images$
declare
  brewing_images_udt text;
begin
  select c.udt_name
    into brewing_images_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'posts'
    and c.column_name = 'brewing_images';

  if brewing_images_udt = 'jsonb' then
    alter table public.posts add column if not exists brewing_images_compat text[];

    execute $sql$
      update public.posts
      set brewing_images_compat = case
        when brewing_images is null then null
        when jsonb_typeof(brewing_images) = 'array' then array(select jsonb_array_elements_text(brewing_images))
        when jsonb_typeof(brewing_images) = 'string' then array[brewing_images #>> '{}']
        else array[brewing_images::text]
      end
    $sql$;

    alter table public.posts drop column brewing_images;
    alter table public.posts rename column brewing_images_compat to brewing_images;
  elsif brewing_images_udt = 'json' then
    alter table public.posts add column if not exists brewing_images_compat text[];

    execute $sql$
      update public.posts
      set brewing_images_compat = case
        when brewing_images is null then null
        when jsonb_typeof(brewing_images::jsonb) = 'array' then array(select jsonb_array_elements_text(brewing_images::jsonb))
        when jsonb_typeof(brewing_images::jsonb) = 'string' then array[(brewing_images::jsonb) #>> '{}']
        else array[(brewing_images::jsonb)::text]
      end
    $sql$;

    alter table public.posts drop column brewing_images;
    alter table public.posts rename column brewing_images_compat to brewing_images;
  elsif brewing_images_udt = 'text' then
    alter table public.posts add column if not exists brewing_images_compat text[];

    execute $sql$
      update public.posts
      set brewing_images_compat = case
        when brewing_images is null or btrim(brewing_images) = '' then null
        else array[brewing_images]
      end
    $sql$;

    alter table public.posts drop column brewing_images;
    alter table public.posts rename column brewing_images_compat to brewing_images;
  end if;
end
$posts_brewing_images$;

update public.posts
set brewing_images = coalesce(brewing_images, '{}'::text[]),
    like_count = coalesce(like_count, 0),
    comment_count = coalesce(comment_count, 0),
    created_at = coalesce(created_at, timezone('utc', now())),
    updated_at = coalesce(updated_at, created_at, timezone('utc', now()));

alter table public.posts alter column brewing_images set default '{}'::text[];
alter table public.posts alter column like_count set default 0;
alter table public.posts alter column comment_count set default 0;
alter table public.posts alter column created_at set default timezone('utc', now());
alter table public.posts alter column updated_at set default timezone('utc', now());
alter table public.posts alter column brewing_images set not null;
alter table public.posts alter column like_count set not null;
alter table public.posts alter column comment_count set not null;
alter table public.posts alter column created_at set not null;
alter table public.posts alter column updated_at set not null;

do $posts_author_id_constraint$
begin
  if exists (select 1 from public.posts where author_id is null) then
    raise notice 'public.posts.author_id 仍存在空值，保留可空以兼容历史数据。';
  else
    alter table public.posts alter column author_id set not null;
  end if;
end
$posts_author_id_constraint$;

-- 社区故事表：用于 24 小时圈内速览 / Story 形态内容。
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '24 hours'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 兼容已存在的旧版 `stories` 表：补齐文案、过期时间与时间戳字段，并迁移历史 user_id/avatar_url 结构。
alter table public.stories add column if not exists author_id uuid references public.profiles(id) on delete cascade;
alter table public.stories add column if not exists image_url text;
alter table public.stories add column if not exists caption text;
alter table public.stories add column if not exists expires_at timestamptz;
alter table public.stories add column if not exists created_at timestamptz;
alter table public.stories add column if not exists updated_at timestamptz;

do $stories_legacy_columns$
declare
  has_user_id boolean;
  has_name boolean;
  has_avatar_url boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'name'
  ) into has_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'avatar_url'
  ) into has_avatar_url;

  if has_user_id then
    execute $sql$
      update public.stories
      set author_id = coalesce(author_id, user_id)
      where author_id is null
        and user_id is not null
    $sql$;
  end if;

  if has_avatar_url then
    execute $sql$
      update public.stories
      set image_url = coalesce(image_url, avatar_url)
      where image_url is null
        and avatar_url is not null
    $sql$;
  end if;

  if has_name then
    execute $sql$
      update public.stories
      set caption = coalesce(caption, name)
      where caption is null
        and name is not null
    $sql$;
  end if;

  update public.stories
  set expires_at = coalesce(expires_at, timezone('utc', now()) + interval '24 hours'),
      created_at = coalesce(created_at, timezone('utc', now())),
      updated_at = coalesce(updated_at, created_at, timezone('utc', now()))
  where expires_at is null
     or created_at is null
     or updated_at is null;
end
$stories_legacy_columns$;

alter table public.stories alter column expires_at set default (timezone('utc', now()) + interval '24 hours');
alter table public.stories alter column created_at set default timezone('utc', now());
alter table public.stories alter column updated_at set default timezone('utc', now());
alter table public.stories alter column expires_at set not null;
alter table public.stories alter column created_at set not null;
alter table public.stories alter column updated_at set not null;

do $stories_required_columns$
begin
  if exists (select 1 from public.stories where author_id is null) then
    raise notice 'public.stories.author_id 仍存在空值，保留可空以兼容历史数据。';
  else
    alter table public.stories alter column author_id set not null;
  end if;

  if exists (select 1 from public.stories where image_url is null) then
    raise notice 'public.stories.image_url 仍存在空值，保留可空以兼容历史数据。';
  else
    alter table public.stories alter column image_url set not null;
  end if;
end
$stories_required_columns$;


-- 帖子评论表：支持一级评论与回复（通过 `parent_id` 建立父子关系）。
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  content text not null,
  like_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 兼容已存在的旧版 `post_comments` 表：补齐回复与互动计数字段。
alter table public.post_comments add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;
alter table public.post_comments add column if not exists like_count integer;
alter table public.post_comments add column if not exists created_at timestamptz;
alter table public.post_comments add column if not exists updated_at timestamptz;

update public.post_comments
set like_count = coalesce(like_count, 0),
    created_at = coalesce(created_at, timezone('utc', now())),
    updated_at = coalesce(updated_at, timezone('utc', now()));

alter table public.post_comments alter column like_count set default 0;
alter table public.post_comments alter column created_at set default timezone('utc', now());
alter table public.post_comments alter column updated_at set default timezone('utc', now());
alter table public.post_comments alter column like_count set not null;
alter table public.post_comments alter column created_at set not null;
alter table public.post_comments alter column updated_at set not null;


-- 帖子点赞表：记录用户对社区帖子的点赞关系。
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, user_id)
);

-- 评论点赞表：记录用户对帖子评论的点赞关系。
create table if not exists public.comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (comment_id, user_id)
);

-- 帖子收藏表：记录用户收藏的社区帖子。
create table if not exists public.post_bookmarks (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, user_id)
);

-- 文章点赞表：记录用户对茶道文章的点赞关系。
create table if not exists public.article_likes (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (article_id, user_id)
);

-- 文章收藏表：记录用户收藏的茶道文章，供详情页与后续个人中心复用。
create table if not exists public.article_bookmarks (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (article_id, user_id)
);

-- Story 浏览表：记录用户看过哪些社区故事，用于已读状态展示。
create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (story_id, user_id)
);

-- 为社区与内容相关表补充数据库级中文注释，便于在 Supabase Studio 中直接查看字段含义。
comment on table public.profiles is '用户档案表，存储昵称、手机号、头像、会员等级和积分等资料。';
comment on column public.profiles.id is '用户档案主键，对应 auth.users.id。';
comment on column public.profiles.name is '用户昵称。';
comment on column public.profiles.phone is '用户手机号，保持唯一。';
comment on column public.profiles.avatar_url is '用户头像地址。';
comment on column public.profiles.bio is '用户个人简介。';
comment on column public.profiles.member_tier is '会员等级，例如新叶会员。';
comment on column public.profiles.points is '会员积分。';
comment on column public.profiles.created_at is '档案创建时间。';
comment on column public.profiles.updated_at is '档案最近更新时间。';

comment on table public.articles is '茶道文章表，存储文章标题、封面、正文内容和发布状态。';
comment on column public.articles.id is '文章主键。';
comment on column public.articles.title is '文章标题。';
comment on column public.articles.slug is '文章唯一别名，可用于 SEO 或路由。';
comment on column public.articles.subtitle is '文章副标题或摘要。';
comment on column public.articles.category is '文章分类，例如茶史、冲泡、器物。';
comment on column public.articles.image_url is '文章封面图地址。';
comment on column public.articles.read_time is '预估阅读时长，例如 5 分钟。';
comment on column public.articles.date is '面向前端展示的日期文本。';
comment on column public.articles.content is '文章正文内容，使用 JSON 数组存储段落、标题和图片块。';
comment on column public.articles.is_featured is '是否为精选推荐文章。';
comment on column public.articles.is_published is '是否已发布。';
comment on column public.articles.published_at is '文章发布时间。';
comment on column public.articles.created_at is '文章创建时间。';
comment on column public.articles.updated_at is '文章最近更新时间。';

comment on table public.seasonal_picks is '时令茶单表，用于展示当前主推的时令精选内容。';
comment on column public.seasonal_picks.id is '时令茶单主键。';
comment on column public.seasonal_picks.name is '时令茶单名称。';
comment on column public.seasonal_picks.description is '时令茶单描述。';
comment on column public.seasonal_picks.image_url is '时令茶单配图地址。';
comment on column public.seasonal_picks.is_active is '是否启用展示。';
comment on column public.seasonal_picks.sort_order is '排序值，数值越小越靠前。';
comment on column public.seasonal_picks.created_at is '时令茶单创建时间。';
comment on column public.seasonal_picks.updated_at is '时令茶单最近更新时间。';

comment on table public.posts is '社区帖子表，承载晒图、冲泡记录、问答等用户内容。';
comment on column public.posts.id is '帖子主键。';
comment on column public.posts.author_id is '发帖用户 ID，关联 profiles.id。';
comment on column public.posts.type is '帖子类型，例如 photo、brewing、question。';
comment on column public.posts.location is '发帖地点。';
comment on column public.posts.image_url is '帖子主图地址。';
comment on column public.posts.caption is '晒图类帖子的文案说明。';
comment on column public.posts.tea_name is '冲泡记录中的茶品名称。';
comment on column public.posts.brewing_data is '冲泡参数 JSON，例如温度、时间、投茶量。';
comment on column public.posts.brewing_images is '冲泡过程配图数组。';
comment on column public.posts.quote is '适合语录型内容的引用文案。';
comment on column public.posts.title is '问答类或主题帖标题。';
comment on column public.posts.description is '问答类或长文本帖正文描述。';
comment on column public.posts.like_count is '帖子点赞数聚合字段。';
comment on column public.posts.comment_count is '帖子评论数聚合字段。';
comment on column public.posts.created_at is '帖子创建时间。';
comment on column public.posts.updated_at is '帖子最近更新时间。';

comment on table public.stories is '社区故事表，用于 24 小时限时展示的轻内容。';
comment on column public.stories.id is '故事主键。';
comment on column public.stories.author_id is '发布故事的用户 ID。';
comment on column public.stories.image_url is '故事图片地址。';
comment on column public.stories.caption is '故事文案说明。';
comment on column public.stories.expires_at is '故事过期时间，默认 24 小时后失效。';
comment on column public.stories.created_at is '故事创建时间。';
comment on column public.stories.updated_at is '故事最近更新时间。';

comment on table public.post_comments is '帖子评论表，支持评论与回复。';
comment on column public.post_comments.id is '评论主键。';
comment on column public.post_comments.post_id is '所属帖子 ID。';
comment on column public.post_comments.author_id is '评论作者 ID。';
comment on column public.post_comments.parent_id is '父评论 ID，用于实现回复结构。';
comment on column public.post_comments.content is '评论正文内容。';
comment on column public.post_comments.like_count is '评论点赞数聚合字段。';
comment on column public.post_comments.created_at is '评论创建时间。';
comment on column public.post_comments.updated_at is '评论最近更新时间。';

comment on table public.post_likes is '帖子点赞关系表，记录用户对帖子的点赞。';
comment on column public.post_likes.post_id is '被点赞的帖子 ID。';
comment on column public.post_likes.user_id is '执行点赞的用户 ID。';
comment on column public.post_likes.created_at is '点赞创建时间。';

comment on table public.comment_likes is '评论点赞关系表，记录用户对评论的点赞。';
comment on column public.comment_likes.comment_id is '被点赞的评论 ID。';
comment on column public.comment_likes.user_id is '执行点赞的用户 ID。';
comment on column public.comment_likes.created_at is '点赞创建时间。';

comment on table public.post_bookmarks is '帖子收藏关系表，记录用户收藏的社区帖子。';
comment on column public.post_bookmarks.post_id is '被收藏的帖子 ID。';
comment on column public.post_bookmarks.user_id is '执行收藏的用户 ID。';
comment on column public.post_bookmarks.created_at is '收藏创建时间。';

comment on table public.article_likes is '文章点赞关系表，记录用户对茶道文章的点赞。';
comment on column public.article_likes.article_id is '被点赞的文章 ID。';
comment on column public.article_likes.user_id is '执行点赞的用户 ID。';
comment on column public.article_likes.created_at is '点赞创建时间。';

comment on table public.article_bookmarks is '文章收藏关系表，记录用户收藏的茶道文章。';
comment on column public.article_bookmarks.article_id is '被收藏的文章 ID。';
comment on column public.article_bookmarks.user_id is '执行收藏的用户 ID。';
comment on column public.article_bookmarks.created_at is '收藏创建时间。';

comment on table public.story_views is '故事浏览关系表，记录用户已读的社区故事。';
comment on column public.story_views.story_id is '被浏览的故事 ID。';
comment on column public.story_views.user_id is '浏览故事的用户 ID。';
comment on column public.story_views.created_at is '浏览记录创建时间。';

-- 文章发布时间索引：加速文章按发布时间倒序读取。

create index if not exists idx_articles_published_at on public.articles (published_at desc);

-- 时令茶单排序索引：加速首页按排序字段读取。
create index if not exists idx_seasonal_picks_sort_order on public.seasonal_picks (sort_order asc, created_at asc);

-- 帖子发布时间索引：加速社区时间线倒序查询。
create index if not exists idx_posts_created_at on public.posts (created_at desc);

-- 帖子作者索引：便于查询某用户发布的帖子。
create index if not exists idx_posts_author_id on public.posts (author_id);

-- Story 过期时间索引：便于筛选最近且未过期的故事。
create index if not exists idx_stories_expires_at on public.stories (expires_at desc);

-- 评论索引：便于按帖子读取评论列表并按时间排序。
create index if not exists idx_post_comments_post_id on public.post_comments (post_id, created_at asc);

-- 帖子点赞按用户索引：便于快速查询当前用户已点赞帖子。
create index if not exists idx_post_likes_user_id on public.post_likes (user_id);

-- 帖子收藏按用户索引：便于快速查询当前用户已收藏帖子。
create index if not exists idx_post_bookmarks_user_id on public.post_bookmarks (user_id);

-- 文章点赞按用户索引：便于快速查询当前用户已点赞文章。
create index if not exists idx_article_likes_user_id on public.article_likes (user_id);

-- 文章收藏按用户索引：便于快速查询当前用户已收藏文章。
create index if not exists idx_article_bookmarks_user_id on public.article_bookmarks (user_id);

-- Story 浏览按用户索引：便于快速判断用户是否看过某个故事。
create index if not exists idx_story_views_user_id on public.story_views (user_id);

comment on index public.idx_articles_published_at is '文章表按发布时间倒序查询索引。';
comment on index public.idx_seasonal_picks_sort_order is '时令茶单按排序值和创建时间查询索引。';
comment on index public.idx_posts_created_at is '帖子表按创建时间倒序查询索引。';
comment on index public.idx_posts_author_id is '帖子表按作者查询索引。';
comment on index public.idx_stories_expires_at is '故事表按过期时间筛选索引。';
comment on index public.idx_post_comments_post_id is '评论表按帖子和创建时间查询索引。';
comment on index public.idx_post_likes_user_id is '帖子点赞表按用户查询索引。';
comment on index public.idx_post_bookmarks_user_id is '帖子收藏表按用户查询索引。';
comment on index public.idx_article_likes_user_id is '文章点赞表按用户查询索引。';
comment on index public.idx_article_bookmarks_user_id is '文章收藏表按用户查询索引。';
comment on index public.idx_story_views_user_id is '故事浏览表按用户查询索引。';

-- 重算帖子点赞数：由点赞触发器调用，保证聚合字段与明细表一致。

create or replace function public.refresh_post_like_count(target_post_id uuid)
returns void
language plpgsql
as $$
begin
  update public.posts
     set like_count = (
       select count(*)::integer
       from public.post_likes
       where post_id = target_post_id
     )
   where id = target_post_id;
end;
$$;

-- 重算帖子评论数：由评论触发器调用，保证帖子评论数准确。
create or replace function public.refresh_post_comment_count(target_post_id uuid)
returns void
language plpgsql
as $$
begin
  update public.posts
     set comment_count = (
       select count(*)::integer
       from public.post_comments
       where post_id = target_post_id
     )
   where id = target_post_id;
end;
$$;

-- 重算评论点赞数：由评论点赞触发器调用，保证评论 like_count 准确。
create or replace function public.refresh_comment_like_count(target_comment_id uuid)
returns void
language plpgsql
as $$
begin
  update public.post_comments
     set like_count = (
       select count(*)::integer
       from public.comment_likes
       where comment_id = target_comment_id
     )
   where id = target_comment_id;
end;
$$;

-- 帖子点赞变更触发器函数：点赞新增/删除后刷新帖子点赞数。
create or replace function public.handle_post_like_change()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_post_like_count(coalesce(new.post_id, old.post_id));
  return coalesce(new, old);
end;
$$;

-- 帖子评论变更触发器函数：评论新增/删除后刷新帖子评论数。
create or replace function public.handle_post_comment_change()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_post_comment_count(coalesce(new.post_id, old.post_id));
  return coalesce(new, old);
end;
$$;

-- 评论点赞变更触发器函数：点赞新增/删除后刷新评论点赞数。
create or replace function public.handle_comment_like_change()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_comment_like_count(coalesce(new.comment_id, old.comment_id));
  return coalesce(new, old);
end;
$$;

comment on function public.set_updated_at() is '通用更新时间触发器函数，在记录更新时自动写入 updated_at。';
comment on function public.handle_new_user() is '新用户注册后自动创建或补齐用户档案记录。';
comment on function public.refresh_post_like_count(uuid) is '根据帖子点赞明细表重算指定帖子的点赞数。';
comment on function public.refresh_post_comment_count(uuid) is '根据帖子评论明细表重算指定帖子的评论数。';
comment on function public.refresh_comment_like_count(uuid) is '根据评论点赞明细表重算指定评论的点赞数。';
comment on function public.handle_post_like_change() is '帖子点赞变更触发器函数，用于刷新帖子点赞数聚合字段。';
comment on function public.handle_post_comment_change() is '帖子评论变更触发器函数，用于刷新帖子评论数聚合字段。';
comment on function public.handle_comment_like_change() is '评论点赞变更触发器函数，用于刷新评论点赞数聚合字段。';

-- 档案更新时间触发器：更新资料时自动刷新 `updated_at`。

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 文章更新时间触发器：更新文章时自动刷新 `updated_at`。
drop trigger if exists set_articles_updated_at on public.articles;
create trigger set_articles_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

-- 时令茶单更新时间触发器：更新内容时自动刷新 `updated_at`。
drop trigger if exists set_seasonal_picks_updated_at on public.seasonal_picks;
create trigger set_seasonal_picks_updated_at
before update on public.seasonal_picks
for each row execute function public.set_updated_at();

-- 帖子更新时间触发器：更新帖子时自动刷新 `updated_at`。
drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

-- Story 更新时间触发器：更新故事时自动刷新 `updated_at`。
drop trigger if exists set_stories_updated_at on public.stories;
create trigger set_stories_updated_at
before update on public.stories
for each row execute function public.set_updated_at();

-- 评论更新时间触发器：更新评论时自动刷新 `updated_at`。
drop trigger if exists set_post_comments_updated_at on public.post_comments;
create trigger set_post_comments_updated_at
before update on public.post_comments
for each row execute function public.set_updated_at();

-- 帖子点赞统计触发器：监听点赞新增/删除并回写帖子聚合字段。
drop trigger if exists trg_post_like_change on public.post_likes;
create trigger trg_post_like_change
after insert or delete on public.post_likes
for each row execute function public.handle_post_like_change();

-- 帖子评论统计触发器：监听评论新增/删除并回写帖子聚合字段。
drop trigger if exists trg_post_comment_change on public.post_comments;
create trigger trg_post_comment_change
after insert or delete on public.post_comments
for each row execute function public.handle_post_comment_change();

-- 评论点赞统计触发器：监听评论点赞新增/删除并回写评论聚合字段。
drop trigger if exists trg_comment_like_change on public.comment_likes;
create trigger trg_comment_like_change
after insert or delete on public.comment_likes
for each row execute function public.handle_comment_like_change();

comment on trigger set_profiles_updated_at on public.profiles is '资料更新前自动刷新 profiles.updated_at。';
comment on trigger set_articles_updated_at on public.articles is '文章更新前自动刷新 articles.updated_at。';
comment on trigger set_seasonal_picks_updated_at on public.seasonal_picks is '时令茶单更新前自动刷新 seasonal_picks.updated_at。';
comment on trigger set_posts_updated_at on public.posts is '帖子更新前自动刷新 posts.updated_at。';
comment on trigger set_stories_updated_at on public.stories is '故事更新前自动刷新 stories.updated_at。';
comment on trigger set_post_comments_updated_at on public.post_comments is '评论更新前自动刷新 post_comments.updated_at。';
comment on trigger trg_post_like_change on public.post_likes is '帖子点赞新增或删除后自动回写 posts.like_count。';
comment on trigger trg_post_comment_change on public.post_comments is '帖子评论新增或删除后自动回写 posts.comment_count。';
comment on trigger trg_comment_like_change on public.comment_likes is '评论点赞新增或删除后自动回写 post_comments.like_count。';

-- 为所有业务表开启 RLS，后续通过策略按公开读取 / 用户自管方式授权。

alter table public.profiles enable row level security;
alter table public.articles enable row level security;
alter table public.seasonal_picks enable row level security;
alter table public.posts enable row level security;
alter table public.stories enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.comment_likes enable row level security;
alter table public.post_bookmarks enable row level security;
alter table public.article_likes enable row level security;
alter table public.article_bookmarks enable row level security;
alter table public.story_views enable row level security;

-- 档案公开读策略：允许前端读取公开档案信息用于发帖人展示等场景。
drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
on public.profiles for select
to public
using (true);

-- 档案自更新策略：仅允许用户更新自己的资料。
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- 文章公开读策略：仅公开已发布文章。
drop policy if exists "Articles are publicly readable" on public.articles;
create policy "Articles are publicly readable"
on public.articles for select
to public
using (is_published = true);

-- 时令茶单公开读策略：仅公开启用状态的精选内容。
drop policy if exists "Seasonal picks are publicly readable" on public.seasonal_picks;
create policy "Seasonal picks are publicly readable"
on public.seasonal_picks for select
to public
using (is_active = true);

-- 帖子公开读策略：社区时间线允许公开读取。
drop policy if exists "Posts are publicly readable" on public.posts;
create policy "Posts are publicly readable"
on public.posts for select
to public
using (true);

-- 帖子创建策略：仅允许登录用户以自己的身份发帖。
drop policy if exists "Users create own posts" on public.posts;
create policy "Users create own posts"
on public.posts for insert
to authenticated
with check (auth.uid() = author_id);

-- 帖子更新策略：仅允许作者修改自己的帖子。
drop policy if exists "Users update own posts" on public.posts;
create policy "Users update own posts"
on public.posts for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

-- 帖子删除策略：仅允许作者删除自己的帖子。
drop policy if exists "Users delete own posts" on public.posts;
create policy "Users delete own posts"
on public.posts for delete
to authenticated
using (auth.uid() = author_id);

-- Story 公开读策略：仅暴露未过期的故事内容。
drop policy if exists "Stories are publicly readable" on public.stories;
create policy "Stories are publicly readable"
on public.stories for select
to public
using (expires_at > timezone('utc', now()));

-- Story 创建策略：仅允许登录用户创建自己的故事。
drop policy if exists "Users create own stories" on public.stories;
create policy "Users create own stories"
on public.stories for insert
to authenticated
with check (auth.uid() = author_id);

-- Story 更新策略：仅允许作者更新自己的故事。
drop policy if exists "Users update own stories" on public.stories;
create policy "Users update own stories"
on public.stories for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

-- Story 删除策略：仅允许作者删除自己的故事。
drop policy if exists "Users delete own stories" on public.stories;
create policy "Users delete own stories"
on public.stories for delete
to authenticated
using (auth.uid() = author_id);

-- 评论公开读策略：允许公开读取帖子评论列表。
drop policy if exists "Comments are publicly readable" on public.post_comments;
create policy "Comments are publicly readable"
on public.post_comments for select
to public
using (true);

-- 评论创建策略：仅允许登录用户以自己的身份发表评论。
drop policy if exists "Users create own comments" on public.post_comments;
create policy "Users create own comments"
on public.post_comments for insert
to authenticated
with check (auth.uid() = author_id);

-- 评论更新策略：仅允许评论作者修改自己的评论。
drop policy if exists "Users update own comments" on public.post_comments;
create policy "Users update own comments"
on public.post_comments for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

-- 评论删除策略：仅允许评论作者删除自己的评论。
drop policy if exists "Users delete own comments" on public.post_comments;
create policy "Users delete own comments"
on public.post_comments for delete
to authenticated
using (auth.uid() = author_id);

-- 帖子点赞查询策略：仅允许用户查看自己的帖子点赞关系。
drop policy if exists "Users view own post likes" on public.post_likes;
create policy "Users view own post likes"
on public.post_likes for select
to authenticated
using (auth.uid() = user_id);

-- 帖子点赞管理策略：仅允许用户增删自己的帖子点赞关系。
drop policy if exists "Users manage own post likes" on public.post_likes;
create policy "Users manage own post likes"
on public.post_likes for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 评论点赞查询策略：仅允许用户查看自己的评论点赞关系。
drop policy if exists "Users view own comment likes" on public.comment_likes;
create policy "Users view own comment likes"
on public.comment_likes for select
to authenticated
using (auth.uid() = user_id);

-- 评论点赞管理策略：仅允许用户增删自己的评论点赞关系。
drop policy if exists "Users manage own comment likes" on public.comment_likes;
create policy "Users manage own comment likes"
on public.comment_likes for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 帖子收藏查询策略：仅允许用户查看自己的帖子收藏关系。
drop policy if exists "Users view own post bookmarks" on public.post_bookmarks;
create policy "Users view own post bookmarks"
on public.post_bookmarks for select
to authenticated
using (auth.uid() = user_id);

-- 帖子收藏管理策略：仅允许用户增删自己的帖子收藏关系。
drop policy if exists "Users manage own post bookmarks" on public.post_bookmarks;
create policy "Users manage own post bookmarks"
on public.post_bookmarks for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 文章点赞查询策略：仅允许用户查看自己的文章点赞关系。
drop policy if exists "Users view own article likes" on public.article_likes;
create policy "Users view own article likes"
on public.article_likes for select
to authenticated
using (auth.uid() = user_id);

-- 文章点赞管理策略：仅允许用户增删自己的文章点赞关系。
drop policy if exists "Users manage own article likes" on public.article_likes;
create policy "Users manage own article likes"
on public.article_likes for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 文章收藏查询策略：仅允许用户查看自己的文章收藏关系。
drop policy if exists "Users view own article bookmarks" on public.article_bookmarks;
create policy "Users view own article bookmarks"
on public.article_bookmarks for select
to authenticated
using (auth.uid() = user_id);

-- 文章收藏管理策略：仅允许用户增删自己的文章收藏关系。
drop policy if exists "Users manage own article bookmarks" on public.article_bookmarks;
create policy "Users manage own article bookmarks"
on public.article_bookmarks for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Story 浏览查询策略：仅允许用户查看自己的已读 Story 记录。
drop policy if exists "Users view own story views" on public.story_views;
create policy "Users view own story views"
on public.story_views for select
to authenticated
using (auth.uid() = user_id);

-- Story 浏览管理策略：仅允许用户写入自己的已读 Story 记录。
drop policy if exists "Users manage own story views" on public.story_views;
create policy "Users manage own story views"
on public.story_views for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 创建社区媒体存储桶：发帖上传的图片统一落在该 bucket 下。
-- 说明：单个 bucket 在 `storage.buckets` 中属于数据记录而非独立 schema 对象，因此不能像 table / function / policy 那样使用 `comment on` 追加对象注释。
insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do nothing;


-- 社区媒体公开读策略：允许前端直接读取社区公开图片。
drop policy if exists "Community media public read" on storage.objects;
create policy "Community media public read"
on storage.objects for select
to public
using (bucket_id = 'community-media');

-- 社区媒体上传策略：仅允许用户上传到自己 UID 命名的目录下。
drop policy if exists "Community media upload" on storage.objects;
create policy "Community media upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 社区媒体更新策略：仅允许用户更新自己目录下的媒体资源。
drop policy if exists "Community media update" on storage.objects;
create policy "Community media update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'community-media'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'community-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 社区媒体删除策略：仅允许用户删除自己目录下的媒体资源。
drop policy if exists "Community media delete" on storage.objects;
create policy "Community media delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 为所有 RLS 策略补充数据库级中文注释，便于在 Supabase Studio 中直接查看授权含义。
comment on policy "Profiles are publicly readable" on public.profiles is '允许公开读取用户档案基础信息，用于社区作者展示等场景。';
comment on policy "Users update own profile" on public.profiles is '仅允许登录用户更新自己的档案信息。';
comment on policy "Articles are publicly readable" on public.articles is '仅允许公开读取已发布的文章内容。';
comment on policy "Seasonal picks are publicly readable" on public.seasonal_picks is '仅允许公开读取已启用的时令茶单内容。';
comment on policy "Posts are publicly readable" on public.posts is '允许公开读取社区帖子列表与详情。';
comment on policy "Users create own posts" on public.posts is '仅允许登录用户以自己的身份创建帖子。';
comment on policy "Users update own posts" on public.posts is '仅允许帖子作者更新自己的帖子。';
comment on policy "Users delete own posts" on public.posts is '仅允许帖子作者删除自己的帖子。';
comment on policy "Stories are publicly readable" on public.stories is '仅允许公开读取未过期的社区故事内容。';
comment on policy "Users create own stories" on public.stories is '仅允许登录用户以自己的身份创建故事。';
comment on policy "Users update own stories" on public.stories is '仅允许故事作者更新自己的故事。';
comment on policy "Users delete own stories" on public.stories is '仅允许故事作者删除自己的故事。';
comment on policy "Comments are publicly readable" on public.post_comments is '允许公开读取帖子评论内容。';
comment on policy "Users create own comments" on public.post_comments is '仅允许登录用户以自己的身份发表评论。';
comment on policy "Users update own comments" on public.post_comments is '仅允许评论作者更新自己的评论。';
comment on policy "Users delete own comments" on public.post_comments is '仅允许评论作者删除自己的评论。';
comment on policy "Users view own post likes" on public.post_likes is '仅允许用户查看自己的帖子点赞记录。';
comment on policy "Users manage own post likes" on public.post_likes is '仅允许用户增删自己的帖子点赞记录。';
comment on policy "Users view own comment likes" on public.comment_likes is '仅允许用户查看自己的评论点赞记录。';
comment on policy "Users manage own comment likes" on public.comment_likes is '仅允许用户增删自己的评论点赞记录。';
comment on policy "Users view own post bookmarks" on public.post_bookmarks is '仅允许用户查看自己的帖子收藏记录。';
comment on policy "Users manage own post bookmarks" on public.post_bookmarks is '仅允许用户增删自己的帖子收藏记录。';
comment on policy "Users view own article likes" on public.article_likes is '仅允许用户查看自己的文章点赞记录。';
comment on policy "Users manage own article likes" on public.article_likes is '仅允许用户增删自己的文章点赞记录。';
comment on policy "Users view own article bookmarks" on public.article_bookmarks is '仅允许用户查看自己的文章收藏记录。';
comment on policy "Users manage own article bookmarks" on public.article_bookmarks is '仅允许用户增删自己的文章收藏记录。';
comment on policy "Users view own story views" on public.story_views is '仅允许用户查看自己的故事浏览记录。';
comment on policy "Users manage own story views" on public.story_views is '仅允许用户写入和维护自己的故事浏览记录。';
-- 注意：`postgres` 可以在 `storage.objects` 上创建策略，但由于该表 owner 是 `supabase_storage_admin`，
-- 对存储策略执行 `comment on policy` 会报 `must be owner of relation objects`，因此这里跳过注释，避免迁移失败。

-- 将核心社区表与文章互动表加入 Supabase Realtime 发布集，便于后续实时刷新。

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- 帖子主表加入实时发布。
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
    ) then
      alter publication supabase_realtime add table public.posts;
    end if;

    -- 社区故事表加入实时发布。
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stories'
    ) then
      alter publication supabase_realtime add table public.stories;
    end if;

    -- 评论表加入实时发布。
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_comments'
    ) then
      alter publication supabase_realtime add table public.post_comments;
    end if;

    -- 帖子点赞表加入实时发布。
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_likes'
    ) then
      alter publication supabase_realtime add table public.post_likes;
    end if;

    -- 评论点赞表加入实时发布。
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comment_likes'
    ) then
      alter publication supabase_realtime add table public.comment_likes;
    end if;

    -- 帖子收藏表加入实时发布。
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_bookmarks'
    ) then
      alter publication supabase_realtime add table public.post_bookmarks;
    end if;

    -- 文章点赞表加入实时发布。
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'article_likes'
    ) then
      alter publication supabase_realtime add table public.article_likes;
    end if;

    -- 文章收藏表加入实时发布。
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'article_bookmarks'
    ) then
      alter publication supabase_realtime add table public.article_bookmarks;
    end if;

    -- Story 浏览表加入实时发布。
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'story_views'
    ) then
      alter publication supabase_realtime add table public.story_views;
    end if;

    execute 'comment on publication supabase_realtime is ''Supabase 实时发布集，用于向客户端广播社区内容与互动数据的变更。''';
  end if;
end
$$;

