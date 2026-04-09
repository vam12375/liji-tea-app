create unique index if not exists addresses_user_single_default_idx
  on public.addresses (user_id)
  where is_default;

comment on index public.addresses_user_single_default_idx is
  '同一用户最多只能有一个默认收货地址。';

create or replace function public.upsert_user_address(
  p_address_id uuid default null,
  p_name text default null,
  p_phone text default null,
  p_address text default null,
  p_make_default boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.addresses%rowtype;
  v_result public.addresses%rowtype;
  v_has_existing_address boolean := false;
  v_should_default boolean := false;
begin
  if v_user_id is null then
    raise exception '请先登录后再保存地址。';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception '收件人姓名不能为空。';
  end if;

  if coalesce(btrim(p_phone), '') = '' then
    raise exception '收件人手机号不能为空。';
  end if;

  if coalesce(btrim(p_address), '') = '' then
    raise exception '收货地址不能为空。';
  end if;

  if p_address_id is null then
    select exists(
      select 1
      from public.addresses
      where user_id = v_user_id
    ) into v_has_existing_address;

    v_should_default := p_make_default or not v_has_existing_address;

    if v_should_default then
      update public.addresses
      set is_default = false
      where user_id = v_user_id
        and is_default = true;
    end if;

    insert into public.addresses (
      user_id,
      name,
      phone,
      address,
      is_default
    )
    values (
      v_user_id,
      btrim(p_name),
      btrim(p_phone),
      btrim(p_address),
      v_should_default
    )
    returning * into v_result;

    return to_jsonb(v_result);
  end if;

  select *
  into v_existing
  from public.addresses
  where id = p_address_id
  for update;

  if not found then
    raise exception '收货地址不存在。';
  end if;

  if v_existing.user_id <> v_user_id then
    raise exception '无权修改该收货地址。';
  end if;

  v_should_default := v_existing.is_default or p_make_default;

  if p_make_default then
    update public.addresses
    set is_default = false
    where user_id = v_user_id
      and id <> p_address_id
      and is_default = true;
  end if;

  update public.addresses
  set
    name = btrim(p_name),
    phone = btrim(p_phone),
    address = btrim(p_address),
    is_default = v_should_default
  where id = p_address_id
    and user_id = v_user_id
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

comment on function public.upsert_user_address(uuid, text, text, text, boolean) is
  '以事务方式新增或更新当前登录用户的收货地址；如需设为默认，会在同一事务内清理其他默认地址。';

revoke all on function public.upsert_user_address(uuid, text, text, text, boolean) from public;
grant execute on function public.upsert_user_address(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.upsert_user_address(uuid, text, text, text, boolean) to service_role;

create or replace function public.set_default_user_address(
  p_address_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.addresses%rowtype;
begin
  if v_user_id is null then
    raise exception '请先登录后再设置默认地址。';
  end if;

  select *
  into v_result
  from public.addresses
  where id = p_address_id
  for update;

  if not found then
    raise exception '收货地址不存在。';
  end if;

  if v_result.user_id <> v_user_id then
    raise exception '无权设置该收货地址。';
  end if;

  update public.addresses
  set is_default = false
  where user_id = v_user_id
    and id <> p_address_id
    and is_default = true;

  update public.addresses
  set is_default = true
  where id = p_address_id
    and user_id = v_user_id
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

comment on function public.set_default_user_address(uuid) is
  '以事务方式设置当前登录用户的默认收货地址，并保证同一时刻只有一个默认地址。';

revoke all on function public.set_default_user_address(uuid) from public;
grant execute on function public.set_default_user_address(uuid) to authenticated;
grant execute on function public.set_default_user_address(uuid) to service_role;
