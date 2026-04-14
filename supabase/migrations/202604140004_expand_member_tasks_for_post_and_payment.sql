-- 扩展积分任务：新增首次发帖与首次订单完成奖励，并通过触发器自动发放积分。

insert into public.point_tasks (code, title, description, points_reward, cycle_type, is_active)
values
  ('first_post', '首次发帖', '首次发布社区内容可获得积分', 20, 'once', true),
  ('first_paid_order', '首次订单完成', '首次完成订单签收可获得积分', 50, 'once', true)
on conflict (code) do update
set title = excluded.title,
    description = excluded.description,
    points_reward = excluded.points_reward,
    cycle_type = excluded.cycle_type,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

comment on column public.point_tasks.code is '任务编码补充：first_post 表示首次发帖，first_paid_order 表示首次订单完成。';

create or replace function public.handle_first_post_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_count integer;
begin
  select count(*)::integer
  into v_post_count
  from public.posts
  where author_id = new.author_id;

  if v_post_count = 1 then
    perform public.grant_points_for_task(
      new.author_id,
      'first_post',
      'post',
      new.id,
      '首次发帖奖励'
    );
  end if;

  return new;
end;
$$;

comment on function public.handle_first_post_points() is '当用户首次发布社区内容时，自动发放首次发帖积分。';

drop trigger if exists trg_first_post_points on public.posts;
create trigger trg_first_post_points
after insert on public.posts
for each row
execute function public.handle_first_post_points();

comment on trigger trg_first_post_points on public.posts is '首次发帖后自动发放积分奖励。';

create or replace function public.handle_first_paid_order_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed_order_count integer;
begin
  if new.status = 'delivered' and old.status is distinct from new.status then
    select count(*)::integer
    into v_completed_order_count
    from public.orders
    where user_id = new.user_id
      and status = 'delivered';

    if v_completed_order_count = 1 then
      perform public.grant_points_for_task(
        new.user_id,
        'first_paid_order',
        'order',
        new.id,
        '首次订单完成奖励'
      );
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_first_paid_order_points() is '当用户首次完成订单签收时，自动发放首次订单完成积分。';

drop trigger if exists trg_first_paid_order_points on public.orders;
create trigger trg_first_paid_order_points
after update on public.orders
for each row
execute function public.handle_first_paid_order_points();

comment on trigger trg_first_paid_order_points on public.orders is '首次订单签收完成后自动发放积分奖励。';