/**
 * useOneClickLogin.ts - 一键登录业务逻辑 Hook
 *
 * 职责（SOLID-Single）：封装一键登录的完整业务逻辑
 * - 状态管理（loading / error / isSupported）
 * - 登录流程编排（检查支持 → 获取 Token → 调用后端验证 → 更新状态）
 * - 与 userStore 集成（登录成功后刷新用户数据）
 *
 * 遵循 KISS：一个 Hook 只做一件事
 * 遵循 YAGNI：暂不包含缓存策略和错误重试逻辑
 */

import { useState, useCallback, useEffect } from 'react';
import AliOneClickModule, { OneClickLoginResult, AliLoginErrorCodes } from '@/modules/ali-one-login';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { showModal } from '@/stores/modalStore';

/**
 * Hook 返回接口定义
 */
export interface UseOneClickLogin {
  /** 登录中状态 */
  loading: boolean;
  /** 最近一次错误信息 */
  error: string | null;
  /** 当前环境是否支持一键登录 */
  isSupported: boolean;
  /** 检查支持状态（可主动调用刷新） */
  checkSupport: () => Promise<boolean>;
  /** 执行一键登录 */
  login: () => Promise<{ success: boolean; error?: string }>;
  /** 退出登录（释放资源） */
  quit: () => Promise<void>;
}

/**
 * 一键登录 Hook
 *
 * 使用示例：
 * ```typescript
 * const { loading, isSupported, login } = useOneClickLogin();
 *
 * return (
 *   <Button onPress={login} disabled={loading || !isSupported}>
 *     本机号码一键登录
 *   </Button>
 * );
 * ```
 */
export function useOneClickLogin(): UseOneClickLogin {
  // 登录中状态
  const [loading, setLoading] = useState(false);
  // 错误信息
  const [error, setError] = useState<string | null>(null);
  // 是否支持一键登录（由 checkSupport 设置）
  const [isSupported, setIsSupported] = useState(false);

  // 从 userStore 获取用户数据刷新方法
  const { fetchProfile, fetchAddresses, fetchFavorites } = useUserStore();

  /**
   * 检查当前环境是否支持一键登录
   *
   * 建议在组件挂载时调用，后续 SDK 会缓存结果
   * @returns boolean
   */
  const checkSupport = useCallback(async (): Promise<boolean> => {
    try {
      const supported = await AliOneClickModule.checkEnvAvailable();
      setIsSupported(supported);
      return supported;
    } catch (err) {
      console.warn('[useOneClickLogin] checkSupport 失败:', err);
      setIsSupported(false);
      return false;
    }
  }, []);

  /**
   * 初始化：检查支持状态
   * 组件挂载时自动调用，卸载时释放资源
   */
  useEffect(() => {
    checkSupport();
    return () => {
      AliOneClickModule.quit();
    };
  }, [checkSupport]);

  /**
   * 一键登录主流程
   *
   * 完整流程：
   * 1. 检查环境支持
   * 2. 调起授权页获取 Token
   * 3. 调用 Supabase Edge Function 验证 Token
   * 4. 验证通过后更新 userStore（session + profile + addresses + favorites）
   *
   * @returns { success: true } 登录成功
   * @returns { success: false, error: string } 登录失败，包含错误信息
   */
  const login = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    // 防止重复点击
    if (loading) return { success: false, error: '正在登录中' };

    setLoading(true);
    setError(null);

    try {
      // ========== 步骤 1：检查环境支持 ==========
      const supported = await AliOneClickModule.checkEnvAvailable();
      if (!supported) {
        return {
          success: false,
          error: '当前网络环境不支持一键登录，请使用其他方式登录',
        };
      }

      // ========== 步骤 2：调起授权页获取 Token ==========
      let token: string;
      let phoneNumber: string;

      try {
        const result: OneClickLoginResult = await AliOneClickModule.login();
        token = result.token;
        phoneNumber = result.phoneNumber;
      } catch (err: any) {
        // 用户取消：不显示错误，静默返回
        if (err?.code === AliLoginErrorCodes.USER_CANCEL || err?.message?.includes('用户取消')) {
          setLoading(false);
          return { success: false }; // success=false, error=undefined = 用户取消
        }
        throw err;
      }

      // Token 为空
      if (!token) {
        return { success: false, error: '未获取到登录凭证，请重试' };
      }

      // ========== 步骤 3：调用 Supabase Edge Function 验证 Token ==========
      const { data, error: edgeError } = await supabase.functions.invoke<{
        session?: object;
        error?: string;
      }>('ali-login', {
        body: { token },
      });

      // Edge Function 调用失败
      if (edgeError) {
        console.error('[useOneClickLogin] Edge Function 调用失败:', edgeError);
        return { success: false, error: '登录验证失败，请稍后重试' };
      }

      // 后端返回错误
      if (data?.error) {
        console.warn('[useOneClickLogin] 后端验证失败:', data.error);
        return { success: false, error: data.error };
      }

      // ========== 步骤 4：登录成功，更新全局状态 ==========
      if (data?.session) {
        // 使用类型断言（Edge Function 返回的 session 格式兼容）
        const session = data.session as Parameters<typeof useUserStore.getState.setSession>[0];
        useUserStore.getState().setSession(session);

        // 刷新用户相关数据（并行请求提升性能）
        await Promise.all([fetchProfile(), fetchAddresses(), fetchFavorites()]);

        setLoading(false);
        return { success: true };
      }

      // 意外情况：session 不存在
      return { success: false, error: '登录失败，请稍后重试' };

    } catch (err: any) {
      console.error('[useOneClickLogin] 登录异常:', err);
      const errorMessage = err?.message || '一键登录失败，请稍后重试';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [loading, fetchProfile, fetchAddresses, fetchFavorites]);

  /**
   * 退出登录，释放 SDK 资源
   */
  const quit = useCallback(async (): Promise<void> => {
    try {
      await AliOneClickModule.quit();
    } catch (err) {
      console.warn('[useOneClickLogin] quit 失败:', err);
    }
  }, []);

  return {
    loading,
    error,
    isSupported,
    checkSupport,
    login,
    quit,
  };
}
