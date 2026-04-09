-- 修复订单号生成依赖 gen_random_bytes() 的问题。
-- 某些环境未启用 pgcrypto扩展时，create_order_with_reserved_stock -> orders.order_no 触发器
-- 会在插入 orders 时抛出：function gen_random_bytes(integer) does not exist。
--
--这里将随机串来源改为内置 md5(random() || clock_timestamp())，避免依赖 pgcrypto。

create or replace function public.generate_order_no()
returns trigger
language plpgsql
as $$
declare
  date_str text;
  candidate text;
rand_str text;
  retry_count integer :=0;
begin
  date_str :=to_char(timezone('utc', now()), 'YYYYMMDD');

  loop
    rand_str := upper(substr(md5(random()::text ||clock_timestamp()::text || retry_count::text), 1, 8));
    candidate := 'LJ' || date_str ||rand_str;

    if not exists (
      select 1
from public.orders
      where order_no = candidate
    ) then
      new.order_no := candidate;
      return new;
    end if;

    retry_count := retry_count + 1;

    if retry_count >= 5 then
rand_str := upper(substr(md5(random()::text || clock_timestamp()::text || retry_count::text), 1, 12));
      candidate := 'LJ' || date_str ||rand_str;

      if not exists (
        select 1
        from public.orders
        where order_no = candidate
      ) then
new.order_no := candidate;
        return new;
      end if;
    end if;
  end loop;
end;
$$;

comment on function public.generate_order_no() is
'生成订单号：LJ + UTC日期(YYYYMMDD) +随机大写十六进制串；不依赖 pgcrypto 扩展。';
