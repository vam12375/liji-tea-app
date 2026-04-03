/**
 * AliOneClickModule.ts - 阿里云融合认证 TypeScript 桥接层
 *
 * 融合认证流程：
 * 1. JS 层调用服务端（Supabase Edge Function）获取鉴权 Token
 * 2. 调用 initWithToken 初始化 SDK
 * 3. 调用 login 调起认证页，获取 verifyToken
 * 4. 服务端用 verifyToken 调用 VerifyWithFusionAuthToken 获取手机号并登录
 */

import { NativeModules, Platform } from 'react-native';

// ============================================================
// 类型定义
// ============================================================

interface AliOneClickNativeModule {
  initWithToken(authToken: string): Promise<boolean>;
  login(templateId: string): Promise<FusionLoginResult>;
  quit(): Promise<void>;
}

/**
 * 融合认证成功返回结果
 */
export interface FusionLoginResult {
  /** 融合认证 SDK 返回的 verifyToken，需传给服务端验证 */
  verifyToken: string;
}

/**
 * 错误码定义（与 Android Native Module 保持一致）
 */
export const AliLoginErrorCodes = {
  /** 用户主动取消 */
  USER_CANCEL: 'E_USER_CANCEL',
  /** 无法获取 Activity */
  NO_ACTIVITY: 'E_NO_ACTIVITY',
  /** SDK 未初始化，请先调用 initWithToken */
  NOT_INIT: 'E_NOT_INIT',
  /** 登录失败 */
  LOGIN_FAILED: 'E_LOGIN_FAILED',
  /** 网络不可用 */
  NETWORK_UNAVAILABLE: 'E_NETWORK_UNAVAILABLE',
} as const;

// ============================================================
// 获取 Native Module 实例
// ============================================================

const NativeModule = NativeModules.AliOneClickModule as Partial<AliOneClickNativeModule> | undefined;

function isModuleAvailable(
  module: Partial<AliOneClickNativeModule> | undefined
): module is AliOneClickNativeModule {
  return (
    !!module &&
    typeof module.initWithToken === 'function' &&
    typeof module.login === 'function' &&
    typeof module.quit === 'function'
  );
}

function requireNativeModule(): AliOneClickNativeModule {
  if (!isModuleAvailable(NativeModule)) {
    throw Object.assign(new Error('原生模块未加载'), { code: AliLoginErrorCodes.NOT_INIT });
  }

  return NativeModule;
}

if (!isModuleAvailable(NativeModule)) {
  console.warn(
    '[AliOneClickModule] 原生模块未找到。请确保：\n' +
    `  平台: ${Platform.OS}\n` +
    '  Android: 在 MainApplication 中注册了 AliOneClickPackage\n' +
    '  已重新构建 Android 项目'
  );
}

// ============================================================
// 导出模块
// ============================================================

/**
 * 阿里云融合认证模块
 *
 * 使用示例：
 * ```typescript
 * import AliOneClickModule from '@/modules/ali-one-login/src/AliOneClickModule';
 *
 * // 1. 从服务端获取鉴权 Token
 * const authToken = await fetchFusionAuthToken(); // Supabase Edge Function
 *
 * // 2. 初始化 SDK
 * await AliOneClickModule.initWithToken(authToken);
 *
 * // 3. 调起认证页，获取 verifyToken
 * const { verifyToken } = await AliOneClickModule.login();
 *
 * // 4. 服务端验证 verifyToken，获取手机号并登录
 * const user = await verifyFusionToken(verifyToken);
 * ```
 */
const AliOneClickModule = {
  /**
   * 使用服务端鉴权 Token 初始化融合认证 SDK
   *
   * @param authToken 由服务端（Supabase Edge Function）获取的鉴权 Token
   * @returns Promise<boolean> 初始化成功返回 true
   */
  initWithToken: async (authToken: string): Promise<boolean> => {
    const nativeModule = requireNativeModule();
    return await nativeModule.initWithToken(authToken);
  },

  /**
   * 调起融合认证页面，获取 verifyToken
   *
   * 必须先调用 initWithToken 初始化 SDK
   *
   * @returns Promise<FusionLoginResult> 包含 verifyToken
   * @throws error.code === 'E_USER_CANCEL' 用户取消
   * @throws error.code === 'E_NOT_INIT' 未初始化
   */
  login: async (templateId: string): Promise<FusionLoginResult> => {
    const nativeModule = requireNativeModule();
    return await nativeModule.login(templateId);
  },

  /**
   * 释放 SDK 资源
   *
   * 建议在组件卸载或登录完成后调用
   */
  quit: async (): Promise<void> => {
    if (!isModuleAvailable(NativeModule)) return;
    try {
      await NativeModule.quit();
    } catch (error) {
      console.warn('[AliOneClickModule] quit 调用失败:', error);
    }
  },
};

export default AliOneClickModule;
