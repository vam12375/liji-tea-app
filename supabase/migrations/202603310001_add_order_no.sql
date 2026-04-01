-- 新增用户可见展示订单号 order_no，格式：LJ{YYYYMMDD}{8位随机大写十六进制}。
-- 例如：LJ202603314A7F3C2B
-- 使用随机后缀而非自增序列，避免暴露订单总量和规律，防止竞争对手推算业务体量。

-- 在 orders 表新增 order_no 列，唯一且不可为空（由触发器在 INSERT 时自动填充）。
alter table public.orders
  add column if not exists order_no text unique;

comment on column public.orders.order_no is '面向用户的展示订单号，格式 LJ{YYYYMMDD}{8位随机大写十六进制}，由触发器自动赋值，全局唯一，随机后缀不暴露订单总量。';

-- 触发器函数：在订单插入前生成 order_no。
-- 使用 gen_random_bytes(4) 生成 4 字节随机数，转为 8 位大写十六进制。
-- 理论碰撞概率：单日 16^8 ≈ 42 亿种组合，对茶叶电商业务量几乎为零风险。
create or replace function public.generate_order_no()
returns trigger
language plpgsql
as $$
declare
  date_str text;
  rand_str text;
  candidate text;
  attempts int := 0;
begin
  -- 使用上海时区日期，确保展示号与用户感知日期一致。
  date_str := to_char(now() at time zone 'Asia/Shanghai', 'YYYYMMDD');

  -- 极小概率碰撞时重试，最多尝试 5 次。
  loop
    rand_str := upper(encode(gen_random_bytes(4), 'hex'));
    candidate := 'LJ' || date_str || rand_str;

    -- 检查唯一性（orders 表 order_no 有 UNIQUE 约束兜底，这里提前检查减少异常）
    exit when not exists (
      select 1 from public.orders where order_no = candidate
    );

    attempts := attempts + 1;
    if attempts >= 5 then
      -- 超出重试次数时扩展为 6 字节随机数（12 位十六进制），几乎不可能再碰撞。
      rand_str := upper(encode(gen_random_bytes(6), 'hex'));
      candidate := 'LJ' || date_str || rand_str;
      exit;
    end if;
  end loop;

  new.order_no := candidate;
  return new;
end;
$$;

comment on function public.generate_order_no() is '在订单插入前自动生成面向用户的展示订单号 order_no，随机后缀不暴露业务订单量。';

-- 绑定触发器到 orders 表的 INSERT 事件（BEFORE INSERT）。
create trigger set_order_no
  before insert on public.orders
  for each row
  execute function public.generate_order_no();

comment on trigger set_order_no on public.orders is '插入订单前自动生成 order_no 展示号。';

-- 为 order_no 建立查询索引，便于客服或订单详情页快速检索。
create index if not exists orders_order_no_idx
  on public.orders (order_no);

comment on index public.orders_order_no_idx is '订单展示号查询索引。';
