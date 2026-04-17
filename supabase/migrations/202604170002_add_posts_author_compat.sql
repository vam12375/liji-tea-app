-- 兼容旧版社区帖子结构：补齐 posts.author 冗余列，避免历史环境发帖时因 not null 约束失败。

alter table public.posts
  add column if not exists author text;

-- 优先用 profiles.name 回填历史帖子作者名；若昵称缺失，则回退到稳定占位名。
update public.posts p
set author = coalesce(
  nullif(btrim(p.author), ''),
  nullif(btrim(profile.name), ''),
  '茶友' || right(p.author_id::text, 4)
)
from public.profiles profile
where profile.id = p.author_id
  and (p.author is null or btrim(p.author) = '');

-- 对仍未回填成功的记录保留空值，避免历史脏数据阻塞迁移；新发帖由前端同步写入 author。
alter table public.posts
  alter column author drop not null;

comment on column public.posts.author is '兼容旧版社区帖子结构保留的作者昵称冗余列，新写入由前端同步填充。';
