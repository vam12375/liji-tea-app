import {
  addUserFavorite,
  fetchUserFavoriteIds,
  removeUserFavorite,
} from '@/lib/userFavorites';
import { logWarn } from '@/lib/logger';
import { toggleFavoriteIds } from '@/lib/userMutations';
import type { UserState } from '@/stores/userStore';

type UserStoreSet = (
  partial: Partial<UserState> | ((state: UserState) => Partial<UserState>),
) => void;
type UserStoreGet = () => UserState;

const favoriteMutationIds = new Map<string, number>();

// 收藏相关动作独立后，userStore 入口无需再处理乐观更新与回滚细节。
export function createUserStoreFavoriteActions(
  set: UserStoreSet,
  get: UserStoreGet,
): Pick<UserState, 'fetchFavorites' | 'toggleFavorite' | 'isFavorite'> {
  return {
    fetchFavorites: async () => {
      try {
        const userId = get().session?.user?.id;
        if (!userId) {
          return;
        }

        const favorites = await fetchUserFavoriteIds(userId);
        set({ favorites });
      } catch (error) {
        logWarn('userStore', 'fetchFavorites 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    // 保持同步签名：先乐观更新，失败时回滚并重新拉取服务端结果。
    toggleFavorite: (productId) => {
      const userId = get().session?.user?.id;
      const previousFavorites = get().favorites;
      const { wasFavorite, nextFavorites } = toggleFavoriteIds(
        previousFavorites,
        productId,
      );

      set({ favorites: nextFavorites });

      if (!userId) {
        return;
      }

      const requestId = (favoriteMutationIds.get(productId) ?? 0) + 1;
      favoriteMutationIds.set(productId, requestId);

      void (async () => {
        try {
          if (wasFavorite) {
            await removeUserFavorite(userId, productId);
          } else {
            await addUserFavorite(userId, productId);
          }
        } catch (error) {
          if (favoriteMutationIds.get(productId) !== requestId) {
            return;
          }

          logWarn('userStore', 'toggleFavorite 同步失败，已回滚本地状态', {
            productId,
            error: error instanceof Error ? error.message : String(error),
          });

          set({ favorites: previousFavorites });
          await get().fetchFavorites();
        } finally {
          if (favoriteMutationIds.get(productId) === requestId) {
            favoriteMutationIds.delete(productId);
          }
        }
      })();
    },

    isFavorite: (productId) => get().favorites.includes(productId),
  };
}
