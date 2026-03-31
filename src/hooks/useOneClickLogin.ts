import { useState, useCallback, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import AliOneClickModule, { AliLoginErrorCodes } from '@/modules/ali-one-login';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';

export interface UseOneClickLogin {
  loading: boolean;
  error: string | null;
  isSupported: boolean;
  login: () => Promise<{ success: boolean; error?: string }>;
  quit: () => Promise<void>;
}

export function useOneClickLogin(): UseOneClickLogin {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const { fetchProfile, fetchAddresses, fetchFavorites } = useUserStore();

  // 组件挂载时检查模块是否可用，卸载时释放资源
  useEffect(() => {
    // 融合认证无需预检查，模块存在即支持
    setIsSupported(true);
    return () => {
      AliOneClickModule.quit();
    };
  }, []);

  const login = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (loading) return { success: false, error: '正在登录中' };

    setLoading(true);
    setError(null);

    try {
      // ========== 步骤 1：从服务端获取融合认证鉴权 Token ==========
      // supabase-js invoke 不支持 query string，直接用 fetch
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
      const tokenResp = await fetch(
        `${supabaseUrl}/functions/v1/ali-login?action=getAuthToken`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
      );
      if (!tokenResp.ok) {
        return { success: false, error: '获取鉴权 Token 失败，请稍后重试' };
      }
      const tokenData = await tokenResp.json() as { authToken?: string };
      if (!tokenData?.authToken) {
        return { success: false, error: '获取鉴权 Token 失败，请稍后重试' };
      }

      // ========== 步骤 2：初始化 SDK ==========
      await AliOneClickModule.initWithToken(tokenData.authToken);

      // ========== 步骤 3：调起融合认证页面，获取 verifyToken ==========
      const templateId = process.env.EXPO_PUBLIC_ALI_TEMPLATE_ID ?? '';
      let verifyToken: string;
      try {
        const result = await AliOneClickModule.login(templateId);
        verifyToken = result.verifyToken;
      } catch (err: any) {
        if (err?.code === AliLoginErrorCodes.USER_CANCEL) {
          return { success: false };
        }
        throw err;
      }

      // ========== 步骤 4：服务端验证 verifyToken，获取手机号并登录 ==========
      const { data, error: edgeError } = await supabase.functions.invoke<{
        session?: object;
        error?: string;
      }>('ali-login', {
        body: { verifyToken },
      });

      if (edgeError) {
        console.error('[useOneClickLogin] Edge Function 调用失败:', edgeError);
        return { success: false, error: '登录验证失败，请稍后重试' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      // ========== 步骤 5：登录成功，更新全局状态 ==========
      if (data?.session) {
        useUserStore.getState().setSession(data.session as Session);
        await Promise.all([fetchProfile(), fetchAddresses(), fetchFavorites()]);
        return { success: true };
      }

      return { success: false, error: '登录失败，请稍后重试' };

    } catch (err: any) {
      console.error('[useOneClickLogin] 登录异常:', err);
      const msg = err?.message || '一键登录失败，请稍后重试';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [loading, fetchProfile, fetchAddresses, fetchFavorites]);

  const quit = useCallback(async (): Promise<void> => {
    try {
      await AliOneClickModule.quit();
    } catch (err) {
      console.warn('[useOneClickLogin] quit 失败:', err);
    }
  }, []);

  return { loading, error, isSupported, login, quit };
}
