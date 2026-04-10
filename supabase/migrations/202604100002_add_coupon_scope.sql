-- 为优惠券主表补充正式 scope 字段，替代基于 code 的临时推导逻辑。
-- 当前先支持：
-- all      = 全场券
-- shipping = 运费券

alter table public.coupons
  add column if not exists scope text not null default 'all'
 check (scope in ('all', 'shipping'));

comment on column public.coupons.scope is '优惠券作用范围：all 全场券，shipping 运费券。';

update public.coupons
set scope = case
  when upper(code) like '%SHIP%' or upper(code) like '%FREIGHT%' then 'shipping'
  else 'all'
end
where scope is distinct from case
  when upper(code) like '%SHIP%' or upper(code) like '%FREIGHT%' then 'shipping'
  else 'all'
end;

create index if not exists idx_coupons_scope_active_window
  on public.coupons (scope, is_active, starts_at, ends_at);

comment on index public.idx_coupons_scope_active_window is '按作用范围、启用状态与生效窗口过滤优惠券，提升结算与券中心查询性能。';
