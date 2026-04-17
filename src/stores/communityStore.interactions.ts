import { requireAuthenticatedCommunityUserId } from '@/lib/communityInteractions';
import {
  COMMENT_SELECT,
  mapComment,
  type Comment,
  type CommentRow,
  type Post,
} from '@/lib/communityModels';
import { supabase } from '@/lib/supabase';
import type {
  CommunityState,
  CommunityStoreGet,
  CommunityStoreSet,
} from '@/stores/communityStore.types';
import { useUserStore } from '@/stores/userStore';

// 点赞 / 收藏 / 评论 / 评论点赞：改变帖子衍生计数与本地集合。
export function createCommunityInteractionsActions(
  set: CommunityStoreSet,
  get: CommunityStoreGet,
): Pick<
  CommunityState,
  'togglePostLike' | 'togglePostBookmark' | 'addComment' | 'toggleCommentLike'
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
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from('post_likes').insert({
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
          .from('post_bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from('post_bookmarks').insert({
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

    addComment: async (postId, content) => {
      const userId = requireAuthenticatedCommunityUserId(
        useUserStore.getState().session?.user?.id,
      );

      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: userId,
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

        const activePost =
          state.activePost?.id === postId
            ? {
                ...state.activePost,
                comments: state.activePost.comments + 1,
                commentList: [...(state.activePost.commentList ?? []), comment],
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
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from('comment_likes').insert({
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

        const updateComment = (comment: Comment) =>
          comment.id === commentId
            ? {
                ...comment,
                isLiked: !isLiked,
                likes: Math.max(0, comment.likes + (isLiked ? -1 : 1)),
              }
            : comment;

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
