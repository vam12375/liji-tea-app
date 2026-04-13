import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { captureError, logError, logWarn } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import AliOneClickModule, { AliLoginErrorCodes } from '@/modules/ali-one-login';
import { useUserStore } from '@/stores/userStore';

export interface UseOneClickLogin {
  loading: boolean;
  error: string | null;
  isSupported: boolean;
  login: () => Promise<{ success: boolean; error?: string }>;
  quit: () => Promise<void>;
}

interface AliLoginSessionPayload {
  access_token: string;
  refresh_token: string;
}

interface AliLoginEdgeResponse {
  session?: unknown;
  error?: string;
}

// 登录链路依赖服务端返回 session，这里先做一次最小运行时校验。
function isSessionPayload(value: unknown): value is Session & AliLoginSessionPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const session = value as Record<string, unknown>;
  return (
    typeof session.access_token === 'string' &&
    typeof session.refresh_token === 'string' &&
    typeof session.user === 'object' &&
    session.user !== null
  );
}

export function useOneClickLogin(): UseOneClickLogin {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // 只订阅一键登录真正依赖的 action，避免整个 userStore 变化导致回调频繁重建。
  const fetchProfile = useUserStore((state) => state.fetchProfile);
  const fetchAddresses = useUserStore((state) => state.fetchAddresses);
  const fetchFavorites = useUserStore((state) => state.fetchFavorites);
  const setSession = useUserStore((state) => state.setSession);

  useEffect(() => {
    setIsSupported(true);

    // 页面卸载时主动退出阿里一键登录弹层，避免原生残留状态。
    return () => {
      void AliOneClickModule.quit();
    };
  }, []);

  const login = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (loading) {
      return { success: false, error: '正在登录中' };
    }

    setLoading(true);
    setError(null);

    try {
      // 先向服务端申请鉴权 token，再把 verifyToken 交给 Edge Function 换 session。
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

      const tokenResp = await fetch(
        `${supabaseUrl}/functions/v1/ali-login?action=getAuthToken`,
        {
          headers: {
            apikey: publishableKey,
            Authorization: `Bearer ${publishableKey}`,
          },
        },
      );

      if (!tokenResp.ok) {
        return {
          success: false,
          error: '获取鉴权 Token 失败，请稍后重试',
        };
      }

      const tokenData = (await tokenResp.json()) as { authToken?: string };
      if (!tokenData.authToken) {
        return {
          success: false,
          error: '获取鉴权 Token 失败，请稍后重试',
        };
      }

      await AliOneClickModule.initWithToken(tokenData.authToken);

      const templateId = process.env.EXPO_PUBLIC_ALI_TEMPLATE_ID ?? '';
      let verifyToken: string;

      try {
        const result = await AliOneClickModule.login(templateId);
        verifyToken = result.verifyToken;
      } catch (err: unknown) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          err.code === AliLoginErrorCodes.USER_CANCEL
        ) {
          return { success: false };
        }

        throw err;
      }

      const { data, error: edgeError } = await supabase.functions.invoke<AliLoginEdgeResponse>(
        'ali-login',
        {
          body: { verifyToken },
        },
      );

      if (edgeError) {
        logError('oneClickLogin', 'Edge Function 调用失败', {
          error: edgeError instanceof Error ? edgeError.message : String(edgeError),
        });
        return {
          success: false,
          error: '登录验证失败，请稍后重试',
        };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      if (isSessionPayload(data?.session)) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError || !sessionData.session) {
          logError('oneClickLogin', 'Session 写入失败', {
            error: sessionError?.message ?? '未知错误',
          });
          return {
            success: false,
            error: sessionError?.message ?? '登录态写入失败，请稍后重试',
          };
        }

        // 先写入 session，再并发补齐用户资料，保证返回页面时认证上下文已经完整。
        setSession(sessionData.session);
        await Promise.all([fetchProfile(), fetchAddresses(), fetchFavorites()]);
        return { success: true };
      }

      return { success: false, error: '登录失败，请稍后重试' };
    } catch (err: unknown) {
      captureError(err, { scope: 'oneClickLogin', message: '登录异常' });
      const message = err instanceof Error ? err.message : '一键登录失败，请稍后重试';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [fetchAddresses, fetchFavorites, fetchProfile, loading, setSession]);

  const quit = useCallback(async (): Promise<void> => {
    try {
      await AliOneClickModule.quit();
    } catch (err) {
      logWarn('oneClickLogin', 'quit 失败', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  return { loading, error, isSupported, login, quit };
}
