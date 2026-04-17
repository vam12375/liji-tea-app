import { supabase } from '@/lib/supabase';
import { logWarn } from '@/lib/logger';
import { unregisterStoredPushDevice } from '@/lib/pushNotifications';
import {
  buildSignedOutState,
  deriveUserFields,
} from '@/stores/userStore.shared';
import { getUserStoreErrorMessage } from '@/stores/userStore.utils';
import { useCartStore } from '@/stores/cartStore';
import { useCouponStore } from '@/stores/couponStore';
import type { UserState } from '@/stores/userStore';

type UserStoreSet = (
  partial: Partial<UserState> | ((state: UserState) => Partial<UserState>),
) => void;
type UserStoreGet = () => UserState;

// Auth 与 session 相关动作集中放在这里，避免和地址、收藏逻辑继续混写。
export function createUserStoreAuthActions(
  set: UserStoreSet,
  get: UserStoreGet,
): Pick<
  UserState,
  'setSession' | 'setInitialized' | 'signUp' | 'signIn' | 'signOut'
> {
  return {
    setSession: (session) => {
      const previousSession = get().session;

      if (!session) {
        if (previousSession) {
          useCartStore.getState().clearCart();
        }

        set(buildSignedOutState());
        return;
      }

      set((state) => ({
        session,
        ...deriveUserFields(session, state.profile),
      }));
    },

    setInitialized: () => set({ initialized: true }),

    signUp: async (email, password, name) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name ?? '茶友' } },
        });

        if (error) {
          return error.message;
        }

        // Supabase 对已存在邮箱返回空 identities，不直接暴露邮箱枚举结果。
        if (data?.user?.identities?.length === 0) {
          return '该邮箱已注册，请直接登录';
        }

        return null;
      } catch (error: unknown) {
        logWarn('userStore', 'signUp 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        return getUserStoreErrorMessage(error, '注册失败');
      }
    },

    signIn: async (email, password) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return error?.message ?? null;
      } catch (error: unknown) {
        logWarn('userStore', 'signIn 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        return getUserStoreErrorMessage(error, '登录失败');
      }
    },

    signOut: async () => {
      try {
        await unregisterStoredPushDevice();
        await supabase.auth.signOut();
      } catch (error) {
        logWarn('userStore', 'signOut 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // 退出登录时统一清空购物车和优惠券状态，避免旧账号残留。
      useCartStore.getState().clearCart();
      useCouponStore.getState().reset();
      set(buildSignedOutState());
    },
  };
}
