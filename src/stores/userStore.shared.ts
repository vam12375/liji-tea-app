import type { Session } from '@supabase/supabase-js';

import type { UserRole } from '@/lib/userRole';
import type {
  Profile,
  Address as DBAddress,
  Favorite as DBFavorite,
} from '@/types/database';

export interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  is_default: boolean;
  isDefault?: boolean;
}

export type FavoriteRow = Pick<DBFavorite, 'product_id'>;

interface DerivedUserFields {
  isLoggedIn: boolean;
  name: string;
  phone: string;
  avatar: string;
  memberTier: string;
  points: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

export function mapAddress(address: DBAddress): Address {
  return { ...address, isDefault: address.is_default };
}

export function isProfileRow(value: unknown): value is Profile {
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

export function isAddressRow(value: unknown): value is DBAddress {
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

export function isFavoriteRow(value: unknown): value is FavoriteRow {
  return isRecord(value) && typeof value.product_id === 'string';
}

export function deriveUserFields(
  session: Session | null,
  profile: Profile | null,
): DerivedUserFields {
  return {
    isLoggedIn: !!session,
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    avatar: profile?.avatar_url ?? '',
    memberTier: profile?.member_tier ?? '新叶会员',
    points: profile?.points ?? 0,
  };
}

export function buildSignedOutState() {
  // 登出时把商家角色一并复位为 guest，避免残留的 staff/admin 状态触发后台入口。
  const role: UserRole = 'guest';
  return {
    session: null,
    profile: null,
    addresses: [],
    favorites: [],
    role,
    ...deriveUserFields(null, null),
  };
}
