-- 清理社区模块历史脏数据，并移除会放宽当前授权边界的旧策略。
-- 目标：让数据库状态与当前前端实际依赖保持一致，同时尽量避免大范围结构性删除。

-- 1) 清理无法映射到当前前端模型的旧帖子。
-- 这些记录缺少 author_id，当前前端在 fallback name 逻辑里会直接使用 author_id.slice(-4)，会导致运行时错误。
delete from public.posts
where author_id is null;

-- 2) 清理无法映射到当前前端模型的旧 stories。
-- 当前前端依赖 author_id，并默认 stories 具备 image_url；否则会出现展示和映射异常。
delete from public.stories
where author_id is null
   or image_url is null;

-- 3) 在脏数据清理完成后，收紧字段约束，和前端当前写法保持一致。
alter table public.posts alter column author_id set not null;
alter table public.stories alter column author_id set not null;
alter table public.stories alter column image_url set not null;

-- 4) 删除旧的宽松策略，避免与新策略叠加后放宽访问边界。
-- 文章：应仅允许读取已发布文章。
drop policy if exists "所有人可查看文章" on public.articles;

-- 节气推荐：应仅允许读取启用中的内容。
drop policy if exists "所有人可查看节气推荐" on public.seasonal_picks;

-- 帖子：保留新的公开读和 author_id 约束创建策略，移除旧的宽松版本。
drop policy if exists "所有人可查看帖子" on public.posts;
drop policy if exists "登录用户可发帖" on public.posts;

-- Stories：保留新的“未过期才可读”策略，移除旧的全量公开策略。
drop policy if exists "所有人可查看故事" on public.stories;
