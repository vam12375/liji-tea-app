import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Profile, Address as DBAddress } from '@/types/database';
import { useCartStore } from '@/stores/cartStore';

/** 地址类型（兼容旧代码） */
export interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  is_default: boolean;
  /** 兼容旧字段名 */
  isDefault?: boolean;
}

/** 将 DB 地址映射为兼容格式 */
function mapAddress(a: DBAddress): Address {
  return { ...a, isDefault: a.is_default };
}

/**
 * 从 session/profile 派生兼容旧代码的字段。
 * 每次 session 或 profile 变化时调用，将结果 spread 到 set() 中。
 */
function deriveUserFields(session: Session | null, profile: Profile | null) {
  return {
    isLoggedIn: !!session,
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    avatar: profile?.avatar_url ?? '',
    memberTier: profile?.member_tier ?? '新叶会员',
    points: profile?.points ?? 0,
  };
}

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

  // Auth 方法
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

  setSession: (session) =>
    set((state) => ({
      session,
      ...deriveUserFields(session, state.profile),
    })),

  setInitialized: () => set({ initialized: true }),

  signUp: async (email, password, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name ?? '茶友' } },
      });
      if (error) return error.message;
      // Supabase 对已存在邮箱返回空 identities（不报错，防止邮箱枚举）
      if (data?.user?.identities?.length === 0) {
        return '该邮箱已注册，请直接登录';
      }
      return null;
    } catch (err: any) {
      console.warn('[userStore] signUp 失败:', err);
      return err?.message ?? '注册失败';
    }
  },

  signIn: async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    } catch (err: any) {
      console.warn('[userStore] signIn 失败:', err);
      return err?.message ?? '登录失败';
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[userStore] signOut 失败:', err);
    }
    // 清空用户数据和购物车
    useCartStore.getState().clearCart();
    set({
      session: null,
      profile: null,
      addresses: [],
      favorites: [],
      ...deriveUserFields(null, null),
    });
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
      if (data) {
        set((state) => ({
          profile: data,
          ...deriveUserFields(state.session, data),
        }));
      }
    } catch (err) {
      console.warn('[userStore] fetchProfile 失败:', err);
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
    } catch (err: any) {
      console.warn('[userStore] updateProfile 失败:', err);
      return err?.message ?? '更新失败';
    }
  },

  fetchAddresses: async () => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');

      if (error) throw error;
      if (data) set({ addresses: data.map(mapAddress) });
    } catch (err) {
      console.warn('[userStore] fetchAddresses 失败:', err);
    }
  },

  addAddress: async (address) => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return '未登录';

      // 如果新增地址为默认，先将已有地址全部取消默认
      if (address.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { error } = await supabase
        .from('addresses')
        .insert({ ...address, user_id: userId });

      if (error) return error.message;
      await get().fetchAddresses();
      return null;
    } catch (err: any) {
      console.warn('[userStore] addAddress 失败:', err);
      return err?.message ?? '添加地址失败';
    }
  },

  removeAddress: async (id) => {
    try {
      await supabase.from('addresses').delete().eq('id', id);
      await get().fetchAddresses();
    } catch (err) {
      console.warn('[userStore] removeAddress 失败:', err);
    }
  },

  setDefaultAddress: async (id) => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return;

      // 先取消所有默认，再设置指定地址为默认
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
      await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id);

      await get().fetchAddresses();
    } catch (err) {
      console.warn('[userStore] setDefaultAddress 失败:', err);
    }
  },

  getDefaultAddress: () => get().addresses.find((a) => a.is_default),

  uploadAvatar: async (base64, ext = 'jpg') => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return '未登录';

      // 将 base64 解码为 Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 限制 2MB
      const MAX_SIZE = 2 * 1024 * 1024;
      if (bytes.byteLength > MAX_SIZE) {
        return '图片大小不能超过 2MB';
      }

      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const filePath = `${userId}/avatar.${ext}`;

      // 上传到 Supabase Storage（覆盖旧头像）
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, { upsert: true, contentType: mimeType });

      if (uploadError) return uploadError.message;

      // 获取公开 URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 追加时间戳避免缓存
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      // 更新 profiles 表
      const err = await get().updateProfile({ avatar_url: avatarUrl });
      return err;
    } catch (err: any) {
      console.warn('[userStore] uploadAvatar 失败:', err);
      return err?.message ?? '上传头像失败';
    }
  },

  fetchFavorites: async () => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', userId);

      if (error) throw error;
      if (data) set({ favorites: data.map((f) => f.product_id) });
    } catch (err) {
      console.warn('[userStore] fetchFavorites 失败:', err);
    }
  },

  // 保持同步签名 — 乐观更新 UI，后台异步同步到 Supabase
  toggleFavorite: (productId) => {
    const userId = get().session?.user?.id;
    const isFav = get().favorites.includes(productId);

    // 乐观更新 UI
    if (isFav) {
      set((state) => ({ favorites: state.favorites.filter((id) => id !== productId) }));
    } else {
      set((state) => ({ favorites: [...state.favorites, productId] }));
    }

    // 后台同步到 Supabase（fire-and-forget，不阻塞 UI）
    if (userId) {
      if (isFav) {
        supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId)
          .then();
      } else {
        supabase
          .from('favorites')
          .insert({ user_id: userId, product_id: productId })
          .then();
      }
    }
  },

  isFavorite: (productId) => get().favorites.includes(productId),
}));
