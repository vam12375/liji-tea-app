import { findDefaultItem } from '@/lib/collections';
import {
  addUserAddress,
  fetchUserAddresses,
  removeUserAddress,
  setUserDefaultAddress,
  updateUserAddress,
} from '@/lib/userAddresses';
import { logWarn } from '@/lib/logger';
import { getUserStoreErrorMessage } from '@/stores/userStore.utils';
import type { UserState } from '@/stores/userStore';

type UserStoreSet = (
  partial: Partial<UserState> | ((state: UserState) => Partial<UserState>),
) => void;
type UserStoreGet = () => UserState;

// 收货地址相关动作集中在这里，store 入口只保留状态与模块组装。
export function createUserStoreAddressActions(
  set: UserStoreSet,
  get: UserStoreGet,
): Pick<
  UserState,
  | 'fetchAddresses'
  | 'addAddress'
  | 'removeAddress'
  | 'updateAddress'
  | 'setDefaultAddress'
  | 'getDefaultAddress'
> {
  return {
    fetchAddresses: async () => {
      try {
        const userId = get().session?.user?.id;
        if (!userId) {
          return;
        }

        const addresses = await fetchUserAddresses(userId);
        set({ addresses });
      } catch (error) {
        logWarn('userStore', 'fetchAddresses 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    addAddress: async (address) => {
      try {
        if (!get().session?.user?.id) {
          return '未登录';
        }

        const errorMessage = await addUserAddress(address);
        if (errorMessage) {
          return errorMessage;
        }

        await get().fetchAddresses();
        return null;
      } catch (error: unknown) {
        logWarn('userStore', 'addAddress 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        return getUserStoreErrorMessage(error, '添加地址失败');
      }
    },

    removeAddress: async (id) => {
      try {
        await removeUserAddress(id);
        await get().fetchAddresses();
      } catch (error) {
        logWarn('userStore', 'removeAddress 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    // 编辑地址时继续复用 RPC，保证默认地址切换与写入仍保持原子性。
    updateAddress: async (id, updates) => {
      try {
        if (!get().session?.user?.id) {
          return '未登录';
        }

        const currentAddress =
          get().addresses.find((item) => item.id === id) ?? null;
        if (!currentAddress) {
          return '收货地址不存在';
        }

        const errorMessage = await updateUserAddress(id, currentAddress, updates);
        if (errorMessage) {
          return errorMessage;
        }

        await get().fetchAddresses();
        return null;
      } catch (error: unknown) {
        logWarn('userStore', 'updateAddress 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        return getUserStoreErrorMessage(error, '更新地址失败');
      }
    },

    setDefaultAddress: async (id) => {
      try {
        if (!get().session?.user?.id) {
          return;
        }

        await setUserDefaultAddress(id);
        await get().fetchAddresses();
      } catch (error) {
        logWarn('userStore', 'setDefaultAddress 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    getDefaultAddress: () => findDefaultItem(get().addresses),
  };
}
