interface CommunityFeedPostLike<TComment = unknown> {
  id: string;
  commentList?: readonly TComment[] | undefined;
}

function mergeCommunityFeedPost<T extends CommunityFeedPostLike>(
  existingPost: T | undefined,
  incomingPost: T,
): T {
  if (!existingPost) {
    return incomingPost;
  }

  return {
    ...existingPost,
    ...incomingPost,
    ...(
      incomingPost.commentList !== undefined ||
      existingPost.commentList !== undefined
        ? {
            commentList:
              incomingPost.commentList === undefined
                ? existingPost.commentList
                : incomingPost.commentList,
          }
        : {}
    ),
  };
}

// 分页追加时沿用已有顺序，同时保留详情页已经回写过的富字段。
export function mergeCommunityPostsForPagination<T extends CommunityFeedPostLike>(
  existingPosts: readonly T[],
  incomingPosts: readonly T[],
): T[] {
  if (incomingPosts.length === 0) {
    return [...existingPosts];
  }

  const mergedPosts = [...existingPosts];

  for (const incomingPost of incomingPosts) {
    const index = mergedPosts.findIndex((post) => post.id === incomingPost.id);
    if (index === -1) {
      mergedPosts.push(incomingPost);
      continue;
    }

    mergedPosts[index] = mergeCommunityFeedPost(mergedPosts[index], incomingPost);
  }

  return mergedPosts;
}

// 刷新首页时以服务端最新顺序为准，但不丢掉当前页帖子已拉到的详情数据。
export function mergeCommunityPostsForRefresh<T extends CommunityFeedPostLike>(
  existingPosts: readonly T[],
  incomingPosts: readonly T[],
): T[] {
  if (incomingPosts.length === 0) {
    return [];
  }

  const existingPostMap = new Map(existingPosts.map((post) => [post.id, post]));

  return incomingPosts.map((incomingPost) =>
    mergeCommunityFeedPost(existingPostMap.get(incomingPost.id), incomingPost),
  );
}
