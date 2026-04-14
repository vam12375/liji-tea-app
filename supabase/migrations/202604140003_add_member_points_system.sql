-- 新增会员积分系统：包含任务表、积分流水、用户任务记录、积分发放函数，以及首次评价奖励与每日签到任务。

create table if not exists public.point_tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  points_reward integer not null check (points_reward > 0),
  cycle_type text not null check (cycle_type in ('once', 'daily')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_code text,
  change_type text not null check (change_type in ('earn', 'spend', 'adjust')),
  points_delta integer not null,
  balance_after integer not null,
  source_type text not null,
  source_id uuid,
  remark text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_point_task_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_code text not null,
  task_date date,
  source_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, task_code, task_date)
);

comment on table public.point_tasks is '积分任务定义表，存储签到、首次评价等可获得积分的任务配置。';
comment on column public.point_tasks.id is '积分任务主键。';
comment on column public.point_tasks.code is '任务唯一编码，例如 daily_check_in、first_review。';
comment on column public.point_tasks.title is '任务标题。';
comment on column public.point_tasks.description is '任务说明。';
comment on column public.point_tasks.points_reward is '完成任务可获得的积分数。';
comment on column public.point_tasks.cycle_type is '任务周期类型：once 一次性任务，daily 每日任务。';
comment on column public.point_tasks.is_active is '任务是否启用。';
comment on column public.point_tasks.created_at is '任务创建时间。';
comment on column public.point_tasks.updated_at is '任务最近更新时间。';

comment on table public.point_ledger is '积分流水表，记录每次积分变动及变动后余额。';
comment on column public.point_ledger.id is '积分流水主键。';
comment on column public.point_ledger.user_id is '积分所属用户 ID。';
comment on column public.point_ledger.task_code is '关联的任务编码，可为空。';
comment on column public.point_ledger.change_type is '积分变动类型：earn 获得，spend 消耗，adjust 调整。';
comment on column public.point_ledger.points_delta is '本次积分变动值，可正可负。';
comment on column public.point_ledger.balance_after is '本次变动后的积分余额。';
comment on column public.point_ledger.source_type is '积分来源类型，例如 check_in、review、order。';
comment on column public.point_ledger.source_id is '积分来源记录 ID。';
comment on column public.point_ledger.remark is '积分备注说明。';
comment on column public.point_ledger.created_at is '积分流水创建时间。';

comment on table public.user_point_task_records is '用户任务完成记录表，用于控制一次性任务与每日任务的幂等。';
comment on column public.user_point_task_records.id is '用户任务记录主键。';
comment on column public.user_point_task_records.user_id is '完成任务的用户 ID。';
comment on column public.user_point_task_records.task_code is '完成的任务编码。';
comment on column public.user_point_task_records.task_date is '任务完成日期，每日任务用于按天去重。';
comment on column public.user_point_task_records.source_id is '触发任务完成的来源记录 ID。';
comment on column public.user_point_task_records.created_at is '任务记录创建时间。';

create index if not exists idx_point_ledger_user_id_created_at
  on public.point_ledger (user_id, created_at desc);
create index if not exists idx_user_point_task_records_user_id_task_code
  on public.user_point_task_records (user_id, task_code, created_at desc);

comment on index public.idx_point_ledger_user_id_created_at is '支持按用户和时间倒序查询积分流水。';
comment on index public.idx_user_point_task_records_user_id_task_code is '支持按用户与任务编码查询任务完成记录。';

create or replace function public.set_member_tier_from_points(p_points integer)
returns text
language plpgsql
immutable
as $$
begin
  if p_points >= 2000 then
    return '金叶会员';
  elsif p_points >= 500 then
    return '翡翠会员';
  end if;

  return '新叶会员';
end;
$$;

comment on function public.set_member_tier_from_points(integer) is '根据积分余额返回对应会员等级。';

create or replace function public.grant_points_for_task(
  p_user_id uuid,
  p_task_code text,
  p_source_type text,
  p_source_id uuid default null,
  p_remark text default null,
  p_task_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.point_tasks%rowtype;
  v_profile public.profiles%rowtype;
  v_effective_task_date date;
  v_exists boolean;
  v_next_points integer;
  v_next_tier text;
  v_ledger_id uuid;
begin
  select * into v_task
  from public.point_tasks
  where code = p_task_code
    and is_active = true;

  if not found then
    return jsonb_build_object(
      'success', false,
      'reason', 'task_not_found'
    );
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'reason', 'profile_not_found'
    );
  end if;

  v_effective_task_date := case
    when v_task.cycle_type = 'daily' then coalesce(p_task_date, current_date)
    else null
  end;

  select exists (
    select 1
    from public.user_point_task_records
    where user_id = p_user_id
      and task_code = p_task_code
      and (
        (task_date is null and v_effective_task_date is null)
        or task_date = v_effective_task_date
      )
  ) into v_exists;

  if v_exists then
    return jsonb_build_object(
      'success', false,
      'reason', 'already_completed'
    );
  end if;

  v_next_points := coalesce(v_profile.points, 0) + v_task.points_reward;
  v_next_tier := public.set_member_tier_from_points(v_next_points);

  update public.profiles
  set points = v_next_points,
      member_tier = v_next_tier,
      updated_at = timezone('utc', now())
  where id = p_user_id;

  insert into public.user_point_task_records (
    user_id,
    task_code,
    task_date,
    source_id
  ) values (
    p_user_id,
    p_task_code,
    v_effective_task_date,
    p_source_id
  );

  insert into public.point_ledger (
    user_id,
    task_code,
    change_type,
    points_delta,
    balance_after,
    source_type,
    source_id,
    remark
  ) values (
    p_user_id,
    p_task_code,
    'earn',
    v_task.points_reward,
    v_next_points,
    p_source_type,
    p_source_id,
    coalesce(p_remark, v_task.title)
  ) returning id into v_ledger_id;

  return jsonb_build_object(
    'success', true,
    'ledger_id', v_ledger_id,
    'points', v_next_points,
    'member_tier', v_next_tier,
    'points_reward', v_task.points_reward
  );
end;
$$;

comment on function public.grant_points_for_task(uuid, text, text, uuid, text, date) is '统一为用户发放任务积分，并同步写入任务记录、积分流水和会员等级。';

insert into public.point_tasks (code, title, description, points_reward, cycle_type, is_active)
values
  ('daily_check_in', '每日签到', '每日登录签到可获得积分', 10, 'daily', true),
  ('first_review', '首次评价', '首次完成商品评价可获得积分', 30, 'once', true)
on conflict (code) do update
set title = excluded.title,
    description = excluded.description,
    points_reward = excluded.points_reward,
    cycle_type = excluded.cycle_type,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

create or replace function public.handle_first_review_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review_count integer;
begin
  select count(*)::integer
  into v_review_count
  from public.product_reviews
  where user_id = new.user_id;

  if v_review_count = 1 then
    perform public.grant_points_for_task(
      new.user_id,
      'first_review',
      'review',
      new.id,
      '首次评价奖励'
    );
  end if;

  return new;
end;
$$;

comment on function public.handle_first_review_points() is '当用户首次提交商品评价时，自动发放首次评价积分。';

drop trigger if exists trg_first_review_points on public.product_reviews;
create trigger trg_first_review_points
after insert on public.product_reviews
for each row
execute function public.handle_first_review_points();

comment on trigger trg_first_review_points on public.product_reviews is '首次评价后自动发放积分奖励。';

drop trigger if exists set_point_tasks_updated_at on public.point_tasks;
create trigger set_point_tasks_updated_at
before update on public.point_tasks
for each row
execute function public.set_updated_at();

comment on trigger set_point_tasks_updated_at on public.point_tasks is '积分任务更新前自动刷新 updated_at。';

alter table public.point_tasks enable row level security;
alter table public.point_ledger enable row level security;
alter table public.user_point_task_records enable row level security;

do $point_tasks_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'point_tasks' and policyname = 'Point tasks are publicly readable'
  ) then
    create policy "Point tasks are publicly readable"
    on public.point_tasks
    for select
    to authenticated
    using (is_active = true);
  end if;
end
$point_tasks_policies$;

comment on policy "Point tasks are publicly readable" on public.point_tasks is '允许登录用户读取当前启用的积分任务配置。';

do $point_ledger_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'point_ledger' and policyname = 'Users can read own point ledger'
  ) then
    create policy "Users can read own point ledger"
    on public.point_ledger
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$point_ledger_policies$;

comment on policy "Users can read own point ledger" on public.point_ledger is '仅允许用户读取自己的积分流水。';

do $user_point_task_records_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_point_task_records' and policyname = 'Users can read own point task records'
  ) then
    create policy "Users can read own point task records"
    on public.user_point_task_records
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$user_point_task_records_policies$;

comment on policy "Users can read own point task records" on public.user_point_task_records is '仅允许用户读取自己的任务完成记录。';