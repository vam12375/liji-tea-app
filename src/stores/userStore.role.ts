import { logWarn } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { normalizeUserRole } from '@/lib/userRole';
import type { UserState } from '@/stores/userStore';

type UserStoreSet = (
  partial: Partial<UserState> | ((state: UserState) => Partial<UserState>),
) => void;
type UserStoreGet = () => UserState;

// 商家端角色相关动作。刻意独立成一个文件，避免和 auth / address / favorite 逻辑混写，
// 也便于后续扩展（如多角色、权限矩阵）时集中修改。
export function createUserStoreRoleActions(
  set: UserStoreSet,
  get: UserStoreGet,
): Pick<UserState, 'refreshUserRole'> {
  return {
    refreshUserRole: async () => {
      const userId = get().session?.user?.id;
      if (!userId) {
        // 未登录直接复位为 guest，避免残留上一个账号的角色。
        set({ role: 'guest' });
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle<{ role: string }>();

      if (error) {
        // 拉取失败时降级为 guest，让守卫兜底隐藏商家入口，不影响主流程登录体验。
        logWarn('userStore', '拉取用户角色失败', { error: error.message });
        set({ role: 'guest' });
        return;
      }

      set({ role: normalizeUserRole(data) });
    },
  };
}
