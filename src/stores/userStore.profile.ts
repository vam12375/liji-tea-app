import { supabase } from '@/lib/supabase';
import { logWarn } from '@/lib/logger';
import {
  deriveUserFields,
  isProfileRow,
} from '@/stores/userStore.shared';
import { getUserStoreErrorMessage } from '@/stores/userStore.utils';
import type { UserState } from '@/stores/userStore';

type UserStoreSet = (
  partial: Partial<UserState> | ((state: UserState) => Partial<UserState>),
) => void;
type UserStoreGet = () => UserState;

// 个人资料与头像上传动作统一放在这里，避免 userStore.ts 承担过多细节。
export function createUserStoreProfileActions(
  set: UserStoreSet,
  get: UserStoreGet,
): Pick<UserState, 'fetchProfile' | 'updateProfile' | 'uploadAvatar'> {
  return {
    fetchProfile: async () => {
      try {
        const userId = get().session?.user?.id;
        if (!userId) {
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          throw error;
        }

        if (!isProfileRow(data)) {
          logWarn('userStore', 'fetchProfile 返回了不符合预期的数据', { data });
          return;
        }

        set((state) => ({
          profile: data,
          ...deriveUserFields(state.session, data),
        }));
      } catch (error) {
        logWarn('userStore', 'fetchProfile 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    updateProfile: async (updates) => {
      try {
        const userId = get().session?.user?.id;
        if (!userId) {
          return '未登录';
        }

        const { error } = await supabase
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', userId);

        if (error) {
          return error.message;
        }

        await get().fetchProfile();
        return null;
      } catch (error: unknown) {
        logWarn('userStore', 'updateProfile 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        return getUserStoreErrorMessage(error, '更新失败');
      }
    },

    uploadAvatar: async (base64, ext = 'jpg') => {
      try {
        const userId = get().session?.user?.id;
        if (!userId) {
          return '未登录';
        }

        // 将 base64 解码为二进制，后续直接上传到 Supabase Storage。
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let index = 0; index < binaryString.length; index += 1) {
          bytes[index] = binaryString.charCodeAt(index);
        }

        const maxSize = 2 * 1024 * 1024;
        if (bytes.byteLength > maxSize) {
          return '图片大小不能超过 2MB';
        }

        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const filePath = `${userId}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, bytes, { upsert: true, contentType: mimeType });

        if (uploadError) {
          return uploadError.message;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(filePath);

        // 追加时间戳避免头像被 CDN 或客户端缓存住旧图。
        const avatarUrl = `${publicUrl}?t=${Date.now()}`;
        return get().updateProfile({ avatar_url: avatarUrl });
      } catch (error: unknown) {
        logWarn('userStore', 'uploadAvatar 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        return getUserStoreErrorMessage(error, '上传头像失败');
      }
    },
  };
}
