-- 扩展通知系统与评价 CRUD 能力：补充通用通知函数、订单通知、评价更新/删除通知，以及评价删除权限。

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_type text default null,
  p_related_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    related_type,
    related_id,
    metadata
  ) values (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_related_type,
    p_related_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into created_id;

  return created_id;
end;
$$;

comment on function public.create_notification(uuid, text, text, text, text, uuid, jsonb) is '通用通知创建函数，供订单状态、评价变更等业务复用。';

create or replace function public.handle_product_review_updated_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_owner uuid;
  product_name text;
begin
  if row(to_jsonb(old.*)) is not distinct from row(to_jsonb(new.*)) then
    return new;
  end if;

  select o.user_id into order_owner
  from public.orders o
  where o.id = new.order_id;

  if order_owner is null then
    return new;
  end if;

  select coalesce(nullif(p.name, ''), '商品') into product_name
  from public.products p
  where p.id = new.product_id;

  perform public.create_notification(
    order_owner,
    'review',
    '评价已更新',
    '你对「' || coalesce(product_name, '商品') || '」的评价已更新。',
    'product_review',
    new.id,
    jsonb_build_object(
      'product_id', new.product_id,
      'order_id', new.order_id,
      'order_item_id', new.order_item_id,
      'rating', new.rating,
      'action', 'updated'
    )
  );

  return new;
end;
$$;

comment on function public.handle_product_review_updated_notification() is '当用户更新商品评价后，自动生成一条评价更新通知。';

create or replace function public.handle_product_review_deleted_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_owner uuid;
  product_name text;
begin
  select o.user_id into order_owner
  from public.orders o
  where o.id = old.order_id;

  if order_owner is null then
    return old;
  end if;

  select coalesce(nullif(p.name, ''), '商品') into product_name
  from public.products p
  where p.id = old.product_id;

  perform public.create_notification(
    order_owner,
    'review',
    '评价已删除',
    '你对「' || coalesce(product_name, '商品') || '」的评价已删除。',
    'product_review',
    old.id,
    jsonb_build_object(
      'product_id', old.product_id,
      'order_id', old.order_id,
      'order_item_id', old.order_item_id,
      'action', 'deleted'
    )
  );

  return old;
end;
$$;

comment on function public.handle_product_review_deleted_notification() is '当用户删除商品评价后，自动生成一条评价删除通知。';

create or replace function public.handle_order_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'paid' then
      perform public.create_notification(
        new.user_id,
        'order',
        '订单支付成功',
        '你的订单已支付成功，正在等待仓库处理。',
        'order',
        new.id,
        jsonb_build_object('status', new.status)
      );
    elsif new.status = 'shipping' then
      perform public.create_notification(
        new.user_id,
        'order',
        '订单已发货',
        '你的订单已发货，快去查看物流进度。',
        'order',
        new.id,
        jsonb_build_object('status', new.status)
      );
    elsif new.status = 'delivered' then
      perform public.create_notification(
        new.user_id,
        'order',
        '订单已签收',
        '你的订单已签收，欢迎回来评价本次购买体验。',
        'order',
        new.id,
        jsonb_build_object('status', new.status)
      );
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_order_status_notification() is '当订单状态变更为已支付、已发货、已签收时，自动生成对应订单通知。';

drop trigger if exists trg_product_review_updated_notification on public.product_reviews;
create trigger trg_product_review_updated_notification
after update on public.product_reviews
for each row
execute function public.handle_product_review_updated_notification();

comment on trigger trg_product_review_updated_notification on public.product_reviews is '评价更新后自动写入通知。';

drop trigger if exists trg_product_review_deleted_notification on public.product_reviews;
create trigger trg_product_review_deleted_notification
after delete on public.product_reviews
for each row
execute function public.handle_product_review_deleted_notification();

comment on trigger trg_product_review_deleted_notification on public.product_reviews is '评价删除后自动写入通知。';

drop trigger if exists trg_order_status_notification on public.orders;
create trigger trg_order_status_notification
after update on public.orders
for each row
execute function public.handle_order_status_notification();

comment on trigger trg_order_status_notification on public.orders is '订单状态更新后自动写入订单通知。';

do $product_reviews_delete_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'product_reviews'
      and policyname = 'Users can delete own reviews'
  ) then
    create policy "Users can delete own reviews"
    on public.product_reviews
    for delete
    to authenticated
    using (auth.uid() = user_id);
  end if;
end
$product_reviews_delete_policy$;

comment on policy "Users can delete own reviews" on public.product_reviews is '仅允许登录用户删除自己的商品评价。';