import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import type { UserRole } from '@/lib/userRole';
import { createUserStoreAddressActions } from '@/stores/userStore.addresses';
import { createUserStoreAuthActions } from '@/stores/userStore.auth';
import { createUserStoreFavoriteActions } from '@/stores/userStore.favorites';
import { createUserStoreProfileActions } from '@/stores/userStore.profile';
import { createUserStoreRoleActions } from '@/stores/userStore.role';
import type { Address } from '@/stores/userStore.shared';
import type { Profile, Address as DBAddress } from '@/types/database';

export type { Address } from '@/stores/userStore.shared';

export interface UserState {
  // Auth 状态
  session: Session | null;
  initialized: boolean;

  // 商家端角色（guest=普通顾客，staff/admin=员工），由 user_roles 表归一化得出。
  role: UserRole;

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
  updateProfile: (
    updates: Partial<Pick<Profile, 'name' | 'phone' | 'avatar_url'>>,
  ) => Promise<string | null>;

  // Address 方法
  fetchAddresses: () => Promise<void>;
  addAddress: (
    address: Omit<DBAddress, 'id' | 'user_id' | 'created_at'>,
  ) => Promise<string | null>;
  removeAddress: (id: string) => Promise<void>;
  updateAddress: (
    id: string,
    updates: Partial<Pick<DBAddress, 'name' | 'phone' | 'address' | 'is_default'>>,
  ) => Promise<string | null>;
  setDefaultAddress: (id: string) => Promise<void>;
  getDefaultAddress: () => Address | undefined;

  // Avatar 方法
  uploadAvatar: (base64: string, ext?: string) => Promise<string | null>;

  // Favorites 方法
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;

  // 商家端角色方法
  refreshUserRole: () => Promise<void>;
}

const initialUserState = {
  session: null,
  initialized: false,
  role: 'guest' as UserRole,
  profile: null,
  addresses: [],
  favorites: [],
  isLoggedIn: false,
  name: '',
  phone: '',
  avatar: '',
  memberTier: '新叶会员',
  points: 0,
} satisfies Pick<
  UserState,
  | 'session'
  | 'initialized'
  | 'role'
  | 'profile'
  | 'addresses'
  | 'favorites'
  | 'isLoggedIn'
  | 'name'
  | 'phone'
  | 'avatar'
  | 'memberTier'
  | 'points'
>;

// userStore 入口只负责 state 结构与各业务域 action 的最终组装。
export const useUserStore = create<UserState>()((set, get) => ({
  ...initialUserState,
  ...createUserStoreAuthActions(set, get),
  ...createUserStoreProfileActions(set, get),
  ...createUserStoreAddressActions(set, get),
  ...createUserStoreFavoriteActions(set, get),
  ...createUserStoreRoleActions(set, get),
}));
