import { supabase } from '@/lib/supabase';
import { isFavoriteRow } from '@/stores/userStore.shared';

export async function fetchUserFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    throw new Error('收藏数据返回格式不正确');
  }

  return data.filter(isFavoriteRow).map((item) => item.product_id);
}

export async function addUserFavorite(userId: string, productId: string) {
  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, product_id: productId });

  if (error) {
    throw error;
  }
}

export async function removeUserFavorite(userId: string, productId: string) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);

  if (error) {
    throw error;
  }
}
