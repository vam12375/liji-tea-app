-- 扩展优惠券作用范围，支持分类券与指定商品券。
-- scope 枚举：
-- all      = 全场券
-- shipping = 运费券
-- category = 分类券
-- product  = 指定商品券

alter table public.coupons
  drop constraint if exists coupons_scope_check;

alter table public.coupons
  add column if not exists scope_category_ids text[] not null default '{}',
  add column if not exists scope_product_ids uuid[] not null default '{}';

alter table public.coupons
  alter column scope set default 'all';

alter table public.coupons
  add constraint coupons_scope_check
  check (scope in ('all', 'shipping', 'category', 'product'));

comment on column public.coupons.scope is '优惠券作用范围：all 全场券，shipping 运费券，category 分类券，product 指定商品券。';
comment on column public.coupons.scope_category_ids is '当 scope=category 时生效，命中的商品分类列表。';
comment on column public.coupons.scope_product_ids is '当 scope=product 时生效，命中的商品 ID 列表。';

create index if not exists idx_coupons_scope_category_ids
  on public.coupons using gin (scope_category_ids);

create index if not exists idx_coupons_scope_product_ids
  on public.coupons using gin (scope_product_ids);

comment on index public.idx_coupons_scope_category_ids is '支持按分类范围筛选优惠券。';
comment on index public.idx_coupons_scope_product_ids is '支持按商品范围筛选优惠券。';
