import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type {
  Profile,
  Address as DBAddress,
  Favorite as DBFavorite,
} from '@/types/database';
import { useCartStore } from '@/stores/cartStore';
import { useCouponStore } from '@/stores/couponStore';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isProfileRow(value: unknown): value is Profile {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNullableString(value.name) &&
    isNullableString(value.phone) &&
    isNullableString(value.avatar_url) &&
    typeof value.member_tier === 'string' &&
    typeof value.points === 'number' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

function isAddressRow(value: unknown): value is DBAddress {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.phone === 'string' &&
    typeof value.address === 'string' &&
    typeof value.is_default === 'boolean' &&
    typeof value.created_at === 'string'
  );
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

function buildSignedOutState() {
  return {
    session: null,
    profile: null,
    addresses: [],
    favorites: [],
    ...deriveUserFields(null, null),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type FavoriteRow = Pick<DBFavorite, 'product_id'>;

function isFavoriteRow(value: unknown): value is FavoriteRow {
  return isRecord(value) && typeof value.product_id === 'string';
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
    } catch (err: unknown) {
      console.warn('[userStore] signUp 失败:', err);
      return getErrorMessage(err, '注册失败');
    }
  },

  signIn: async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    } catch (err: unknown) {
      console.warn('[userStore] signIn 失败:', err);
      return getErrorMessage(err, '登录失败');
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[userStore] signOut 失败:', err);
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
        console.warn('[userStore] fetchProfile 返回了不符合预期的数据:', data);
        return;
      }

      set((state) => ({
        profile: data,
        ...deriveUserFields(state.session, data),
      }));
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
    } catch (err: unknown) {
      console.warn('[userStore] updateProfile 失败:', err);
      return getErrorMessage(err, '更新失败');
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
      if (!Array.isArray(data)) {
        console.warn('[userStore] fetchAddresses 返回了不符合预期的数据:', data);
        return;
      }

      set({ addresses: data.filter(isAddressRow).map(mapAddress) });
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
    } catch (err: unknown) {
      console.warn('[userStore] addAddress 失败:', err);
      return getErrorMessage(err, '添加地址失败');
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

  // 编辑地址：支持部分字段更新，设为默认时先清除其他默认
  updateAddress: async (id, updates) => {
    try {
      const userId = get().session?.user?.id;
      if (!userId) return '未登录';

      // 如果设为默认，先清除其他默认地址
      if (updates.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { error } = await supabase
        .from('addresses')
        .update(updates)
        .eq('id', id);

      if (error) return error.message;
      await get().fetchAddresses();
      return null;
    } catch (err: unknown) {
      console.warn('[userStore] updateAddress 失败:', err);
      return err instanceof Error ? err.message : '更新地址失败';
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
    } catch (err: unknown) {
      console.warn('[userStore] uploadAvatar 失败:', err);
      return getErrorMessage(err, '上传头像失败');
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
      if (!Array.isArray(data)) {
        console.warn('[userStore] fetchFavorites 返回了不符合预期的数据:', data);
        return;
      }

      set({ favorites: data.filter(isFavoriteRow).map((f) => f.product_id) });
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
