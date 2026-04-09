import type { Address as DBAddress } from "@/types/database";

export type UserAddressDraft = Pick<
  DBAddress,
  "name" | "phone" | "address" | "is_default"
>;

export interface UpsertUserAddressParams {
  addressId?: string;
  name: string;
  phone: string;
  address: string;
  makeDefault: boolean;
}

export interface FavoriteToggleResult {
  wasFavorite: boolean;
  nextFavorites: string[];
}

function requireNonEmpty(value: string | undefined, field: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field}不能为空。`);
  }

  return normalized;
}

export function resolveAddressUpsertParams(
  currentAddress: UserAddressDraft | null,
  updates: Partial<UserAddressDraft>,
  addressId?: string,
): UpsertUserAddressParams {
  return {
    addressId,
    name: requireNonEmpty(updates.name ?? currentAddress?.name, "收件人姓名"),
    phone: requireNonEmpty(updates.phone ?? currentAddress?.phone, "收件人手机号"),
    address: requireNonEmpty(updates.address ?? currentAddress?.address, "收货地址"),
    makeDefault: updates.is_default ?? false,
  };
}

export function toggleFavoriteIds(
  favorites: readonly string[],
  productId: string,
): FavoriteToggleResult {
  const wasFavorite = favorites.includes(productId);

  return {
    wasFavorite,
    nextFavorites: wasFavorite
      ? favorites.filter((id) => id !== productId)
      : [...favorites, productId],
  };
}
