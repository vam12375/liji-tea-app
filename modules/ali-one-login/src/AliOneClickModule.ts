/**
 * AliOneClickModule.ts - 阿里云一键登录 TypeScript 桥接层
 *
 * 职责（SOLID-Interface Segregation）：
 * - 定义清晰的 Native Module 接口类型
 * - 封装平台差异（iOS/Android）
 * - 提供类型安全的调用包装
 *
 * 遵循 KISS：只做类型定义和转发，无业务逻辑
 * 遵循 YAGNI：暂不包含 Mock/Fallback 逻辑，待实际 SDK 接入
 */

import { NativeModules, Platform } from 'react-native';

// ============================================================
// 类型定义
// ============================================================

/**
 * Native Module 的 TS 接口定义
 * 对应 Android: AliOneClickModule.kt / iOS: AliOneClickModule.swift
 */
interface AliOneClickNativeModule {
  checkEnvAvailable(): Promise<boolean>;
  prefetchToken(): Promise<void>;
  login(): Promise<OneClickLoginResult>;
  quit(): Promise<void>;
}

/**
 * 一键登录成功返回结果
 */
export interface OneClickLoginResult {
  /** 阿里云 SDK 返回的授权 Token */
  token: string;
  /** 脱敏手机号（格式：138****0000） */
  phoneNumber: string;
}

/**
 * 错误码定义（与 Android/iOS Native Module 保持一致）
 */
export const AliLoginErrorCodes = {
  /** 用户主动取消授权 */
  USER_CANCEL: 'E_USER_CANCEL',
  /** 无法获取 Activity（Android）*/
  NO_ACTIVITY: 'E_NO_ACTIVITY',
  /** SDK 未初始化 */
  NOT_INIT: 'E_NOT_INIT',
  /** 登录失败 */
  LOGIN_FAILED: 'E_LOGIN_FAILED',
  /** 网络不可用 */
  NETWORK_UNAVAILABLE: 'E_NETWORK_UNAVAILABLE',
} as const;

// ============================================================
// 获取 Native Module 实例
// ============================================================

/**
 * 从 React Native 获取原生模块实例
 *
 * 注意：在模拟器/Expo Web 等不支持原生模块的平台会返回 undefined
 */
const NativeModule = NativeModules.AliOneClickModule as AliOneClickNativeModule | undefined;

// ============================================================
// 类型守卫：检查模块是否可用
// ============================================================

/**
 * 类型守卫：验证 Native Module 是否已正确加载
 *
 * @returns true 表示模块可用，false 表示未找到（模拟器或未完成 pod install）
 */
function isModuleAvailable(): NativeModule is AliOneClickNativeModule {
  return (
    !!NativeModule &&
    typeof NativeModule.checkEnvAvailable === 'function' &&
    typeof NativeModule.login === 'function' &&
    typeof NativeModule.quit === 'function'
  );
}

// ============================================================
// 警告日志：模块未找到时的友好提示
// ============================================================

if (!isModuleAvailable()) {
  console.warn(
    '[AliOneClickModule] ⚠️ 原生模块未找到。请确保：\n' +
    `  平台: ${Platform.OS}\n` +
    '  Android: 在 MainApplication 中注册了 AliOneClickPackage\n' +
    '  iOS: 已运行 pod install\n' +
    '  当前: 一键登录功能将在支持检测时返回 false'
  );
}

// ============================================================
// 导出模块：统一封装的调用接口
// ============================================================

/**
 * 阿里云一键登录模块 - 对外统一导出接口
 *
 * 使用示例：
 * ```typescript
 * import AliOneClickModule from '@/modules/ali-one-login/src/AliOneClickModule';
 *
 * const supported = await AliOneClickModule.checkEnvAvailable();
 * if (!supported) return;
 *
 * const result = await AliOneClickModule.login();
 * console.log(result.token, result.phoneNumber);
 * ```
 */
const AliOneClickModule = {
  /**
   * 检查当前网络环境是否支持一键登录
   *
   * 检测逻辑：检查 SIM 卡运营商是否支持（移动/联通/电信）
   * 注意：即使返回 true，实际登录时也可能因网络问题失败
   *
   * @returns Promise<boolean> true=支持，false=不支持
   */
  checkEnvAvailable: async (): Promise<boolean> => {
    if (!isModuleAvailable()) {
      // 模块未加载时默认返回 false，避免误导用户
      return false;
    }

    try {
      return await NativeModule.checkEnvAvailable();
    } catch (error) {
      console.warn('[AliOneClickModule] checkEnvAvailable 调用失败:', error);
      return false;
    }
  },

  /**
   * 预取 Token，加速授权页拉起
   *
   * 建议在登录页加载完成后调用（componentDidMount）
   * 可显著缩短用户点击登录按钮后等待授权页的时间
   *
   * @returns Promise<void>
   */
  prefetchToken: async (): Promise<void> => {
    if (!isModuleAvailable()) return;

    try {
      await NativeModule.prefetchToken();
    } catch (error) {
      // 预取失败不阻塞流程，静默处理
      console.warn('[AliOneClickModule] prefetchToken 调用失败:', error);
    }
  },

  /**
   * 调起一键登录授权页，获取授权 Token
   *
   * 核心流程：
   * 1. SDK 调起运营商授权页
   * 2. 用户确认本机号码授权
   * 3. SDK 返回 Token（需传给后端验证）
   *
   * @returns Promise<OneClickLoginResult> 包含 token 和脱敏手机号
   * @throws {Error} error.code === 'E_USER_CANCEL' 用户取消
   * @throws {Error} 其他错误码表示登录失败
   */
  login: async (): Promise<OneClickLoginResult> => {
    if (!isModuleAvailable()) {
      throw Object.assign(new Error('原生模块未初始化'), { code: AliLoginErrorCodes.NOT_INIT });
    }

    return await NativeModule.login();
  },

  /**
   * 退出登录，释放 SDK 资源
   *
   * 建议在组件卸载或用户取消登录时调用
   * 释放内存和系统资源
   *
   * @returns Promise<void>
   */
  quit: async (): Promise<void> => {
    if (!isModuleAvailable()) return;

    try {
      await NativeModule.quit();
    } catch (error) {
      console.warn('[AliOneClickModule] quit 调用失败:', error);
    }
  },
} as AliOneClickModuleInterface;

export default AliOneClickModule;
