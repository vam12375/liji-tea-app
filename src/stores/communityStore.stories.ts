import { STORY_SELECT, mapStory, type StoryRow } from '@/lib/communityModels';
import { logWarn } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type {
  CommunityState,
  CommunityStoreGet,
  CommunityStoreSet,
} from '@/stores/communityStore.types';
import { useUserStore } from '@/stores/userStore';

// 故事圈相关动作：拉取 + 标记已读。与帖子主列表解耦，单独走 stories 表。
export function createCommunityStoriesActions(
  set: CommunityStoreSet,
  get: CommunityStoreGet,
): Pick<CommunityState, 'fetchStories' | 'markStoryViewed'> {
  return {
    fetchStories: async () => {
      try {
        set({ storiesLoading: true });
        const userId = useUserStore.getState().session?.user?.id;
        const { data, error } = await supabase
          .from('stories')
          .select(STORY_SELECT)
          .order('created_at', { ascending: false })
          .limit(30);

        if (error) {
          throw error;
        }

        const storyIds = (data ?? []).map((story) => story.id);
        let viewedIds = new Set<string>();

        if (userId && storyIds.length > 0) {
          const { data: viewRows, error: viewsError } = await supabase
            .from('story_views')
            .select('story_id')
            .eq('user_id', userId)
            .in('story_id', storyIds);

          if (viewsError) {
            throw viewsError;
          }

          viewedIds = new Set((viewRows ?? []).map((row) => row.story_id));
        }

        set({
          stories: ((data ?? []) as StoryRow[]).map((story) =>
            mapStory(story, viewedIds),
          ),
          storiesLoading: false,
        });
      } catch (error) {
        logWarn('communityStore', 'fetchStories 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        set({ stories: [], storiesLoading: false });
      }
    },

    markStoryViewed: async (storyId) => {
      set((state) => ({
        stories: state.stories.map((story) =>
          story.id === storyId ? { ...story, isViewed: true } : story,
        ),
      }));

      const userId = useUserStore.getState().session?.user?.id;
      if (!userId) {
        return;
      }

      const { error } = await supabase.from('story_views').upsert(
        {
          story_id: storyId,
          user_id: userId,
        },
        { onConflict: 'story_id,user_id' },
      );

      if (error) {
        logWarn('communityStore', 'markStoryViewed 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      // get 未消费，保留签名以与其他 slice 对齐。
      void get;
    },
  };
}
