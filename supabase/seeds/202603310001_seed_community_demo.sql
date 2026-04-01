-- 社区演示数据种子。
-- 用途：为当前社区页/帖子详情/Stories/互动状态提供一批可重复执行的测试数据。
-- 特点：
-- 1. 依赖现有 `public.profiles` 用户，不直接写入 `auth.users`
-- 2. 可重复执行：会先清理同一批固定 ID 的演示数据，再重新插入
-- 3. 若已发布文章存在，则顺带补充少量 article like / bookmark 演示关系

begin;

set local search_path = public;

do $seed$
declare
  user_a uuid;
  user_b uuid;
  user_c uuid;
  user_a_name text;
  user_b_name text;
  user_c_name text;
  user_a_avatar text;
  user_b_avatar text;
  user_c_avatar text;
  article_a uuid;
  article_b uuid;


  post_photo_id uuid := '2f53d91c-4b5a-4d46-9d54-c98f6e0f1011';
  post_brewing_id uuid := 'ea630d6f-4ad5-40be-a46d-8af2cf07d222';
  post_question_id uuid := '7c6e3517-aee1-4e37-ae2d-6ef1bf58a333';

  story_a_id uuid := '1a2891df-5d37-48bc-95f3-2d5bbdcf4441';
  story_b_id uuid := '9fb43d85-5eaf-44ab-a795-602cbef95552';

  comment_1_id uuid := 'db6a5740-7e9a-4f9a-8452-02ac3f8f6661';
  comment_2_id uuid := 'a7d2d9f0-5323-4f88-9416-4d8f30ae6662';
  comment_3_id uuid := '6f0b1685-e160-4a80-b6b8-198c172d6663';
begin
  select
    id,
    coalesce(nullif(name, ''), '茶友' || right(id::text, 4)),
    avatar_url
  into user_a, user_a_name, user_a_avatar
  from public.profiles
  order by created_at asc
  limit 1;

  if user_a is null then
    raise notice '跳过社区演示数据写入：当前 public.profiles 为空，请先至少注册一个用户。';
    return;
  end if;

  select
    id,
    coalesce(nullif(name, ''), '茶友' || right(id::text, 4)),
    avatar_url
  into user_b, user_b_name, user_b_avatar
  from public.profiles
  order by created_at asc
  offset 1
  limit 1;

  select
    id,
    coalesce(nullif(name, ''), '茶友' || right(id::text, 4)),
    avatar_url
  into user_c, user_c_name, user_c_avatar
  from public.profiles
  order by created_at asc
  offset 2
  limit 1;

  user_b := coalesce(user_b, user_a);
  user_c := coalesce(user_c, user_b, user_a);
  user_b_name := coalesce(user_b_name, user_a_name);
  user_c_name := coalesce(user_c_name, user_b_name, user_a_name);
  user_b_avatar := coalesce(user_b_avatar, user_a_avatar);
  user_c_avatar := coalesce(user_c_avatar, user_b_avatar, user_a_avatar);


  select id into article_a
  from public.articles
  where coalesce(is_published, false) = true
  order by published_at desc nulls last, created_at desc
  limit 1;

  select id into article_b
  from public.articles
  where coalesce(is_published, false) = true
  order by published_at desc nulls last, created_at desc
  offset 1
  limit 1;

  article_b := coalesce(article_b, article_a);

  -- 清理旧的演示数据，保证脚本可重复执行。
  delete from public.comment_likes
  where comment_id in (comment_1_id, comment_2_id, comment_3_id);

  delete from public.post_likes
  where post_id in (post_photo_id, post_brewing_id, post_question_id);

  delete from public.post_bookmarks
  where post_id in (post_photo_id, post_brewing_id, post_question_id);

  delete from public.story_views
  where story_id in (story_a_id, story_b_id);

  delete from public.post_comments
  where id in (comment_1_id, comment_2_id, comment_3_id);

  delete from public.posts
  where id in (post_photo_id, post_brewing_id, post_question_id);

  delete from public.stories
  where id in (story_a_id, story_b_id);

  if article_a is not null then
    delete from public.article_likes
    where user_id in (user_a, user_b, user_c)
      and article_id in (article_a, article_b);

    delete from public.article_bookmarks
    where user_id in (user_a, user_b, user_c)
      and article_id in (article_a, article_b);
  end if;

  -- Stories
  insert into public.stories (
    id,
    user_id,
    name,
    avatar_url,
    author_id,
    image_url,
    caption,
    expires_at,
    created_at,
    updated_at
  )
  values
    (
      story_a_id,
      user_a,
      user_a_name,
      user_a_avatar,
      user_a,
      'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?auto=format&fit=crop&w=1200&q=80',
      '今晨试了新茶仓的白茶，前调很清，尾韵有一点花香。',
      timezone('utc', now()) + interval '18 hours',
      timezone('utc', now()) - interval '2 hours',
      timezone('utc', now()) - interval '2 hours'
    ),
    (
      story_b_id,
      user_b,
      user_b_name,
      user_b_avatar,
      user_b,
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
      '午后偷得半日闲，换了把小壶泡凤凰单丛。',
      timezone('utc', now()) + interval '20 hours',
      timezone('utc', now()) - interval '70 minutes',
      timezone('utc', now()) - interval '70 minutes'
    );

  -- 帖子：晒图 / 冲泡记录 / 提问
  insert into public.posts (
    id,
    author,
    avatar_url,
    user_id,
    author_id,
    type,
    location,
    image_url,
    caption,
    tea_name,
    brewing_data,
    brewing_images,
    quote,
    title,
    description,
    created_at,
    updated_at
  )
  values
    (
      post_photo_id,
      user_a_name,
      user_a_avatar,
      user_a,
      user_a,
      'photo',
      '杭州·龙井村',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
      '今天在茶园边喝到一杯很干净的龙井，风一吹，豆香一下就起来了。',
      null,
      null,
      '{}'::text[],
      null,
      null,
      null,
      timezone('utc', now()) - interval '5 hours',
      timezone('utc', now()) - interval '5 hours'
    ),
    (
      post_brewing_id,
      user_b_name,
      user_b_avatar,
      user_b,
      user_b,
      'brewing',
      null,
      null,
      null,
      '凤凰单丛·鸭屎香',
      '{"temp":"98°C","time":"12秒","amount":"5g/110ml"}'::jsonb,
      array[
        'https://images.unsplash.com/photo-1464306076886-da185f6a9d05?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?auto=format&fit=crop&w=1200&q=80'
      ]::text[],
      '第一泡香气扬得很高，第三泡开始蜜韵更稳定。',
      null,
      null,
      timezone('utc', now()) - interval '3 hours',
      timezone('utc', now()) - interval '3 hours'
    ),
    (
      post_question_id,
      user_c_name,
      user_c_avatar,
      user_c,
      user_c,
      'question',
      null,
      null,
      null,
      null,
      null,
      '{}'::text[],
      null,
      '新人第一把紫砂壶，建议从什么泥料入手？',
      '平时主要喝岩茶和熟普，预算 500 左右，想先买一把不容易踩雷、日常好养的壶。各位会更推荐朱泥、段泥还是紫泥？',
      timezone('utc', now()) - interval '90 minutes',
      timezone('utc', now()) - interval '90 minutes'
    );

  -- 评论
  insert into public.post_comments (id, post_id, author_id, parent_id, content, created_at, updated_at)
  values
    (
      comment_1_id,
      post_question_id,
      user_a,
      null,
      '如果你常喝岩茶，我会先从紫泥入手，容错率高一些，日常也更稳。',
      timezone('utc', now()) - interval '60 minutes',
      timezone('utc', now()) - interval '60 minutes'
    ),
    (
      comment_2_id,
      post_question_id,
      user_b,
      null,
      '预算 500 的话建议先把重心放在做工和出水，泥料先别太执着。',
      timezone('utc', now()) - interval '42 minutes',
      timezone('utc', now()) - interval '42 minutes'
    ),
    (
      comment_3_id,
      post_brewing_id,
      user_c,
      null,
      '这组参数很实用，我也准备按这个节奏试试同款单丛。',
      timezone('utc', now()) - interval '35 minutes',
      timezone('utc', now()) - interval '35 minutes'
    );

  -- 帖子点赞
  insert into public.post_likes (post_id, user_id, created_at)
  values
    (post_photo_id, user_b, timezone('utc', now()) - interval '4 hours'),
    (post_photo_id, user_c, timezone('utc', now()) - interval '220 minutes'),
    (post_brewing_id, user_a, timezone('utc', now()) - interval '140 minutes'),
    (post_brewing_id, user_c, timezone('utc', now()) - interval '110 minutes'),
    (post_question_id, user_a, timezone('utc', now()) - interval '50 minutes')
  on conflict do nothing;

  -- 帖子收藏
  insert into public.post_bookmarks (post_id, user_id, created_at)
  values
    (post_brewing_id, user_a, timezone('utc', now()) - interval '100 minutes'),
    (post_question_id, user_b, timezone('utc', now()) - interval '40 minutes')
  on conflict do nothing;

  -- 评论点赞
  insert into public.comment_likes (comment_id, user_id, created_at)
  values
    (comment_1_id, user_c, timezone('utc', now()) - interval '38 minutes'),
    (comment_2_id, user_a, timezone('utc', now()) - interval '28 minutes')
  on conflict do nothing;

  -- Story 已读
  insert into public.story_views (story_id, user_id, created_at)
  values
    (story_a_id, user_b, timezone('utc', now()) - interval '30 minutes'),
    (story_b_id, user_a, timezone('utc', now()) - interval '12 minutes')
  on conflict do nothing;

  -- 文章点赞 / 收藏演示（若已有已发布文章）。
  if article_a is not null then
    insert into public.article_likes (article_id, user_id, created_at)
    values
      (article_a, user_a, timezone('utc', now()) - interval '1 day'),
      (article_a, user_b, timezone('utc', now()) - interval '20 hours')
    on conflict do nothing;

    insert into public.article_bookmarks (article_id, user_id, created_at)
    values
      (article_a, user_c, timezone('utc', now()) - interval '16 hours')
    on conflict do nothing;
  end if;

  if article_b is not null then
    insert into public.article_likes (article_id, user_id, created_at)
    values
      (article_b, user_c, timezone('utc', now()) - interval '14 hours')
    on conflict do nothing;

    insert into public.article_bookmarks (article_id, user_id, created_at)
    values
      (article_b, user_a, timezone('utc', now()) - interval '10 hours')
    on conflict do nothing;
  end if;

  raise notice '社区演示数据写入完成：posts=3, stories=2, comments=3。';
end
$seed$;

commit;
