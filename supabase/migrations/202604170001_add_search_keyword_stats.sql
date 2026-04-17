-- 搜索热词统计：用一张极简的计数表 + 两个 security definer RPC 承载。
-- 客户端禁止直读直写，避免被改成 9999 刷榜；所有入口都走 RPC，并做 trim / 长度校验。

create table if not exists public.search_keyword_stats (
  keyword text primary key,
  hit_count bigint not null default 0,
  last_hit_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.search_keyword_stats is '搜索热词计数表：按关键词聚合命中次数与最近一次触发时间。';
comment on column public.search_keyword_stats.keyword is '归一化后的搜索词（trim 后）。';
comment on column public.search_keyword_stats.hit_count is '累计命中次数，由 RPC 维护，不允许直写。';

create index if not exists idx_search_keyword_stats_hit_count_last_hit_at
  on public.search_keyword_stats (hit_count desc, last_hit_at desc);

alter table public.search_keyword_stats enable row level security;

-- 故意不给 authenticated / anon 定义任何 policy：读写都必须走下面的 RPC，
-- 否则请求会被 RLS 默认拒绝。

create or replace function public.record_search_keyword(p_keyword text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trimmed text;
begin
  -- 丢弃空白 / 过长关键词，避免被灌脏数据。
  if p_keyword is null then
    return;
  end if;

  v_trimmed := trim(p_keyword);
  if length(v_trimmed) = 0 or length(v_trimmed) > 60 then
    return;
  end if;

  insert into public.search_keyword_stats (keyword, hit_count, last_hit_at)
    values (v_trimmed, 1, timezone('utc', now()))
    on conflict (keyword) do update
      set hit_count = public.search_keyword_stats.hit_count + 1,
          last_hit_at = timezone('utc', now());
end;
$$;

comment on function public.record_search_keyword(text)
  is '幂等自增热词计数：客户端搜索成功后 fire-and-forget 调用。';

grant execute on function public.record_search_keyword(text) to authenticated, anon;

create or replace function public.get_top_search_keywords(p_limit int default 8)
returns setof text
language sql
security definer
set search_path = public
as $$
  select keyword
    from public.search_keyword_stats
    order by hit_count desc, last_hit_at desc
    -- 兜底边界：防止传入负数 / 过大值。
    limit greatest(1, least(coalesce(p_limit, 8), 50));
$$;

comment on function public.get_top_search_keywords(int)
  is '返回按命中次数倒序的热词列表，默认 8 条。';

grant execute on function public.get_top_search_keywords(int) to authenticated, anon;
