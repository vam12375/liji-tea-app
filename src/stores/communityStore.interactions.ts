import { requireAuthenticatedCommunityUserId } from "@/lib/communityInteractions";
import {
  COMMENT_SELECT,
  mapComment,
  type Comment,
  type CommentRow,
  type Post,
} from "@/lib/communityModels";
import { supabase } from "@/lib/supabase";
import type {
  CommunityState,
  CommunityStoreGet,
  CommunityStoreSet,
} from "@/stores/communityStore.types";
import { useUserStore } from "@/stores/userStore";

// 回复新增后只更新命中的评论分支，避免详情页的整棵评论树重建。
function appendReplyToCommentTree(
  comments: Comment[] | undefined,
  parentCommentId: string,
  nextComment: Comment,
): Comment[] {
  if (!comments?.length) {
    return [nextComment];
  }

  return comments.map((comment) => {
    if (comment.id === parentCommentId) {
      return {
        ...comment,
        replies: [...(comment.replies ?? []), nextComment],
      };
    }

    if (!comment.replies?.length) {
      return comment;
    }

    return {
      ...comment,
      replies: appendReplyToCommentTree(
        comment.replies,
        parentCommentId,
        nextComment,
      ),
    };
  });
}

// 点赞 / 收藏 / 评论 / 评论点赞：改变帖子衍生计数与本地集合。
export function createCommunityInteractionsActions(
  set: CommunityStoreSet,
  get: CommunityStoreGet,
): Pick<
  CommunityState,
  "togglePostLike" | "togglePostBookmark" | "addComment" | "toggleCommentLike"
> {
  return {
    togglePostLike: async (postId) => {
      const userId = requireAuthenticatedCommunityUserId(
        useUserStore.getState().session?.user?.id,
      );
      const state = get();
      const isLiked = state.likedPostIds.has(postId);

      if (isLiked) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from("post_likes").insert({
          post_id: postId,
          user_id: userId,
        });

        if (error) {
          throw error;
        }
      }

      set((current) => {
        const likedPostIds = new Set(current.likedPostIds);
        if (isLiked) {
          likedPostIds.delete(postId);
        } else {
          likedPostIds.add(postId);
        }

        const updatePost = (post: Post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: !isLiked,
                likes: Math.max(0, post.likes + (isLiked ? -1 : 1)),
              }
            : post;

        return {
          likedPostIds,
          posts: current.posts.map(updatePost),
          activePost:
            current.activePost?.id === postId
              ? updatePost(current.activePost)
              : current.activePost,
        };
      });
    },

    togglePostBookmark: async (postId) => {
      const userId = requireAuthenticatedCommunityUserId(
        useUserStore.getState().session?.user?.id,
      );
      const state = get();
      const isBookmarked = state.bookmarkedPostIds.has(postId);

      if (isBookmarked) {
        const { error } = await supabase
          .from("post_bookmarks")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from("post_bookmarks").insert({
          post_id: postId,
          user_id: userId,
        });

        if (error) {
          throw error;
        }
      }

      set((current) => {
        const bookmarkedPostIds = new Set(current.bookmarkedPostIds);
        if (isBookmarked) {
          bookmarkedPostIds.delete(postId);
        } else {
          bookmarkedPostIds.add(postId);
        }

        const updatePost = (post: Post) =>
          post.id === postId
            ? {
                ...post,
                isBookmarked: !isBookmarked,
              }
            : post;

        return {
          bookmarkedPostIds,
          posts: current.posts.map(updatePost),
          activePost:
            current.activePost?.id === postId
              ? updatePost(current.activePost)
              : current.activePost,
        };
      });
    },

    addComment: async (postId, content, parentCommentId) => {
      const userId = requireAuthenticatedCommunityUserId(
        useUserStore.getState().session?.user?.id,
      );

      // 统一走一条评论写入路径，普通评论和回复只差一个 parent_id。
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          author_id: userId,
          parent_id: parentCommentId ?? null,
          content,
        })
        .select(COMMENT_SELECT)
        .single();

      if (error) {
        throw error;
      }

      const comment = mapComment(data as CommentRow, get().likedCommentIds);

      set((state) => {
        const posts = state.posts.map((post) =>
          post.id === postId ? { ...post, comments: post.comments + 1 } : post,
        );

        const nextCommentList = parentCommentId
          ? appendReplyToCommentTree(
              state.activePost?.commentList,
              parentCommentId,
              comment,
            )
          : [...(state.activePost?.commentList ?? []), comment];

        const activePost =
          state.activePost?.id === postId
            ? {
                ...state.activePost,
                comments: state.activePost.comments + 1,
                commentList: nextCommentList,
              }
            : state.activePost;

        return { posts, activePost };
      });

      return comment;
    },

    toggleCommentLike: async (postId, commentId) => {
      const userId = requireAuthenticatedCommunityUserId(
        useUserStore.getState().session?.user?.id,
      );
      const isLiked = get().likedCommentIds.has(commentId);

      if (isLiked) {
        const { error } = await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", userId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from("comment_likes").insert({
          comment_id: commentId,
          user_id: userId,
        });

        if (error) {
          throw error;
        }
      }

      set((state) => {
        const likedCommentIds = new Set(state.likedCommentIds);
        if (isLiked) {
          likedCommentIds.delete(commentId);
        } else {
          likedCommentIds.add(commentId);
        }

        const updateComment = (comment: Comment): Comment => ({
          ...comment,
          ...(comment.id === commentId
            ? {
                isLiked: !isLiked,
                likes: Math.max(0, comment.likes + (isLiked ? -1 : 1)),
              }
            : {}),
          // 评论点赞也需要递归进入回复，保证楼中楼和一级评论行为一致。
          ...(comment.replies?.length
            ? {
                replies: comment.replies.map(updateComment),
              }
            : {}),
        });

        const activePost =
          state.activePost?.id === postId
            ? {
                ...state.activePost,
                commentList: state.activePost.commentList?.map(updateComment),
              }
            : state.activePost;

        return { likedCommentIds, activePost };
      });
    },
  };
}
