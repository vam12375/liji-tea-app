import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import { findDefaultItem } from '@/lib/collections';
import {
  addUserAddress,
  fetchUserAddresses,
  removeUserAddress,
  setUserDefaultAddress,
  updateUserAddress,
} from '@/lib/userAddresses';
import {
  addUserFavorite,
  fetchUserFavoriteIds,
  removeUserFavorite,
} from '@/lib/userFavorites';
import { logWarn } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { toggleFavoriteIds } from '@/lib/userMutations';
import {
  buildSignedOutState,
  deriveUserFields,
  isProfileRow,
} from '@/stores/userStore.shared';
import { useCartStore } from '@/stores/cartStore';
import { useCouponStore } from '@/stores/couponStore';
import type { Address } from '@/stores/userStore.shared';
import type { Profile, Address as DBAddress } from '@/types/database';

export type { Address } from '@/stores/userStore.shared';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const favoriteMutationIds = new Map<string, number>();

interface UserState {
  // Auth 状态
  session: Session | null;
  initialized: boolean;

  // Profile 数据
  profile: Profile | null;
  addresses: Address[];
  favorites: string[];

  // 兼容旧代码的属性（由 deriveUserFields 计算）
isLoggedIn: boolean;
  name: string;
  phone: string;
  avatar: string;
  memberTier: string;
  points: number;

  //Auth 方法
  signUp: (email: string, password: string, name?: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  setInitialized: () => void;

  // Profile 方法
  fetchProfile: () => Promise<void>;
updateProfile: (updates: Partial<Pick<Profile, 'name' | 'phone' | 'avatar_url'>>) => Promise<string | null>;

  // Address 方法
  fetchAddresses: () => Promise<void>;
addAddress: (address: Omit<DBAddress, 'id' | 'user_id' | 'created_at'>) => Promise<string | null>;
  removeAddress: (id: string) => Promise<void>;
updateAddress: (id: string, updates: Partial<Pick<DBAddress, 'name' | 'phone' | 'address' | 'is_default'>>) => Promise<string | null>;
  setDefaultAddress: (id: string) => Promise<void>;
  getDefaultAddress: () => Address | undefined;

  // Avatar 方法
  uploadAvatar: (base64: string, ext?: string) => Promise<string | null>;

  // Favorites 方法
  fetchFavorites: () => Promise<void>;
toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
}

export const useUserStore = create<UserState>()((set, get) => ({
  session: null,
initialized: false,
  profile: null,
  addresses: [],
  favorites: [],

  // 兼容旧代码 — 初始值，后续由 deriveUserFields 更新
  isLoggedIn: false,
  name: '',
phone: '',
  avatar: '',
  memberTier: '新叶会员',
  points: 0,

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
      const {data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name ?? '茶友' } },
      });
      if (error) return error.message;
      //Supabase 对已存在邮箱返回空 identities（不报错，防止邮箱枚举）
      if (data?.user?.identities?.length === 0) {
        return '该邮箱已注册，请直接登录';
      }
      return null;
    } catch (err: unknown) {
      logWarn('userStore', 'signUp 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
      return getErrorMessage(err, '注册失败');
    }
  },

  signIn: async (email, password) => {
    try {
const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    } catch (err:unknown) {
      logWarn('userStore', 'signIn 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
      return getErrorMessage(err, '登录失败');
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      logWarn('userStore', 'signOut 失败', {
        error: err instanceof Error ? err.message : String(err),
});
    }
    // 清空用户数据、购物车和优惠券
    useCartStore.getState().clearCart();
useCouponStore.getState().reset();
    set(buildSignedOutState());
  },

  fetchProfile: async () => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (!isProfileRow(data)) {
        logWarn('userStore', 'fetchProfile 返回了不符合预期的数据', { data });
        return;
      }

      set((state) => ({
        profile: data,
        ...deriveUserFields(state.session, data),
      }));
    } catch (err){
      logWarn('userStore', 'fetchProfile 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  updateProfile: async (updates) => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return '未登录';

      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) return error.message;
      await get().fetchProfile();
      return null;
    } catch (err:unknown) {
      logWarn('userStore', 'updateProfile 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
      return getErrorMessage(err, '更新失败');
    }
  },

  fetchAddresses: async () => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return;

      const addresses = await fetchUserAddresses(userId);
      set({ addresses });
    } catch (err) {
      logWarn('userStore', 'fetchAddresses 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  addAddress: async (address) => {
    try {
      if (!get().session?.user?.id) return '未登录';

      const errorMessage = await addUserAddress(address);
      if (errorMessage) return errorMessage;

      await get().fetchAddresses();
      return null;
    } catch (err: unknown) {
      logWarn('userStore', 'addAddress 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
      return getErrorMessage(err, '添加地址失败');
    }
  },

  removeAddress: async (id) => {
    try {
      await removeUserAddress(id);
      await get().fetchAddresses();
    } catch (err) {
      logWarn('userStore', 'removeAddress 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  //编辑地址：通过 RPC 在单次事务内完成更新与默认地址切换
  updateAddress: async (id, updates) => {
    try {
      if (!get().session?.user?.id) return '未登录';

      const currentAddress = get().addresses.find((item) => item.id === id) ?? null;
      if (!currentAddress) {
        return '收货地址不存在';
      }

      const errorMessage = await updateUserAddress(id, currentAddress, updates);
      if (errorMessage) return errorMessage;

      await get().fetchAddresses();
      return null;
    } catch (err: unknown) {
      logWarn('userStore', 'updateAddress 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
      return getErrorMessage(err, '更新地址失败');
    }
  },

  setDefaultAddress: async (id) => {
    try {
      if (!get().session?.user?.id) return;

      await setUserDefaultAddress(id);
      await get().fetchAddresses();
    } catch (err) {
      logWarn('userStore', 'setDefaultAddress 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  getDefaultAddress: () => findDefaultItem(get().addresses),

  uploadAvatar: async (base64, ext = 'jpg') =>{
    try {
      const userId = get().session?.user?.id;
      if (!userId) return '未登录';

      // 将 base64 解码为 Uint8Array
      const binaryString =atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      //限制 2MB
      const MAX_SIZE = 2 * 1024 * 1024;
      if (bytes.byteLength > MAX_SIZE) {
        return '图片大小不能超过 2MB';
      }

const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const filePath = `${userId}/avatar.${ext}`;

      // 上传到 Supabase Storage（覆盖旧头像）
      const { error:uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, { upsert: true, contentType: mimeType });

      if (uploadError) return uploadError.message;

      //获取公开 URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // 追加时间戳避免缓存
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      // 更新 profiles 表
      const err = await get().updateProfile({ avatar_url: avatarUrl });
      return err;
    } catch (err:unknown) {
      logWarn('userStore', 'uploadAvatar 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
      return getErrorMessage(err, '上传头像失败');
    }
  },

  fetchFavorites: async () => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return;

      const favorites = await fetchUserFavoriteIds(userId);
      set({ favorites });
    } catch (err) {
      logWarn('userStore', 'fetchFavorites 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // 保持同步签名：先乐观更新，失败时回滚并重新拉取服务端结果
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
      } catch (err) {
        if (favoriteMutationIds.get(productId) !== requestId) {
          return;
        }

        logWarn('userStore', 'toggleFavorite 同步失败，已回滚本地状态', {
          productId,
          error: err instanceof Error ? err.message : String(err),
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
}));
