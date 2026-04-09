import { supabase } from "@/lib/supabase";
import { logInfo } from "@/lib/logger";

/**
 * 诊断当前的认证状态和 JWT token
 */
export async function diagnoseAuthState() {
  try {
    // 1. 检查 session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    logInfo("authDiagnostics", "Session 状态", {
      hasSession: !!sessionData.session,
      hasAccessToken: !!sessionData.session?.access_token,
      hasUser: !!sessionData.session?.user,
      userId: sessionData.session?.user?.id,
      sessionError: sessionError?.message,
    });

    if (!sessionData.session) {
      logInfo("authDiagnostics", "未找到 session，尝试刷新");
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      logInfo("authDiagnostics", "刷新 Session 结果", {
        success: !!refreshData.session,
        hasAccessToken: !!refreshData.session?.access_token,
        refreshError: refreshError?.message,
      });
      
      return refreshData.session;
    }

    // 2. 检查 access token
    const accessToken = sessionData.session.access_token;
    if (accessToken) {
      // 解析 JWT (不验证签名，只查看内容)
      try {
        const parts = accessToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const now = Math.floor(Date.now() / 1000);
          const isExpired = payload.exp && payload.exp < now;
          
          logInfo("authDiagnostics", "JWT Token 信息", {
            role: payload.role,
            exp: payload.exp,
            iat: payload.iat,
            isExpired,
            expiresIn: payload.exp ? `${Math.floor((payload.exp - now) / 60)} 分钟` : 'unknown',
          });

          if (isExpired) {
            logInfo("authDiagnostics", "Token 已过期，尝试刷新");
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            logInfo("authDiagnostics", "刷新结果", {
              success: !!refreshData.session,
              refreshError: refreshError?.message,
            });
            
            return refreshData.session;
          }
        }
      } catch (parseError) {
        logInfo("authDiagnostics", "解析 JWT 失败", {
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }
    }

    // 3. 测试 getUser
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    logInfo("authDiagnostics", "getUser 结果", {
      hasUser: !!userData.user,
      userId: userData.user?.id,
      userError: userError?.message,
    });

    return sessionData.session;
  } catch (error) {
    logInfo("authDiagnostics", "诊断失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
