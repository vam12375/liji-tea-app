import { supabase } from '@/lib/supabase';
import { resolveAddressUpsertParams } from '@/lib/userMutations';
import { isAddressRow, mapAddress } from '@/stores/userStore.shared';
import type { Address } from '@/stores/userStore.shared';
import type { Address as DBAddress } from '@/types/database';

export type UserAddressInput = Omit<DBAddress, 'id' | 'user_id' | 'created_at'>;
export type UserAddressUpdate = Partial<
  Pick<DBAddress, 'name' | 'phone' | 'address' | 'is_default'>
>;

function buildUpsertPayload(
  params: ReturnType<typeof resolveAddressUpsertParams>,
) {
  return {
    p_address_id: params.addressId ?? null,
    p_name: params.name,
    p_phone: params.phone,
    p_address: params.address,
    p_make_default: params.makeDefault,
  };
}

export async function fetchUserAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    throw new Error('收货地址返回格式不正确');
  }

  return data.filter(isAddressRow).map(mapAddress);
}

export async function addUserAddress(
  address: UserAddressInput,
): Promise<string | null> {
  const params = resolveAddressUpsertParams(null, address);
  const { error } = await supabase.rpc(
    'upsert_user_address',
    buildUpsertPayload(params),
  );

  return error?.message ?? null;
}

export async function updateUserAddress(
  id: string,
  currentAddress: Address,
  updates: UserAddressUpdate,
): Promise<string | null> {
  const params = resolveAddressUpsertParams(currentAddress, updates, id);
  const { error } = await supabase.rpc(
    'upsert_user_address',
    buildUpsertPayload(params),
  );

  return error?.message ?? null;
}

export async function removeUserAddress(id: string) {
  const { error } = await supabase.from('addresses').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export async function setUserDefaultAddress(id: string) {
  const { error } = await supabase.rpc('set_default_user_address', {
    p_address_id: id,
  });

  if (error) {
    throw error;
  }
}
