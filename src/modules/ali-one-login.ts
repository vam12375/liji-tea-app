/**
 * ali-one-login.ts - 阿里云一键登录模块（桩实现）
 *
 * 遵循 KISS：仅暴露 Hook 所需的最小接口
 * 遵循 YAGNI：暂不包含真实 SDK 接入逻辑
 *
 * TODO：接入阿里云号码认证一键登录 SDK
 *       参考：https://help.aliyun.com/product/75047.html
 *
 * 接入步骤：
 * 1. 安装 SDK：npx expo install 阿里云号码认证包（如有）
 * 2. 配置 AppKey/AppSecret
 * 3. 替换以下桩函数为真实 SDK 调用
 */

import { Platform } from 'react-native';

/**
 * 一键登录结果
 */
export interface OneClickLoginResult {
  /** 运营商返回的认证 Token */
  token: string;
  /** 脱敏手机号（可选，部分 SDK 支持） */
  phoneNumber?: string;
}

/**
 * 阿里登录错误码
 */
export const AliLoginErrorCodes = {
  /** 用户主动取消 */
  USER_CANCEL: 'USER_CANCEL',
  /** 网络不可用 */
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  /** SDK 未初始化 */
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  /** 运营商不支持 */
  OPERATOR_NOT_SUPPORTED: 'OPERATOR_NOT_SUPPORTED',
  /** 未知错误 */
  UNKNOWN: 'UNKNOWN',
} as const;

export type AliLoginErrorCode = (typeof AliLoginErrorCodes)[keyof typeof AliLoginErrorCodes];

/**
 * 阿里云一键登录模块
 *
 * 当前为桩实现，isSupported 始终返回 false
 * 接入真实 SDK 后替换以下三个方法即可
 */
const AliOneClickModule = {
  /**
   * 检查当前环境是否支持一键登录
   * @returns true = 支持，false = 不支持
   */
  checkEnvAvailable: async (): Promise<boolean> => {
    // TODO: 替换为真实 SDK 调用
    // 阿里云号码认证 SDK 示例：
    // return await AlibabaAuth.checkEnvAvailable();
    console.warn('[AliOneClickModule] 桩实现：checkEnvAvailable 始终返回 false，请接入真实 SDK');
    return false;
  },

  /**
   * 调起一键登录授权页，获取 Token
   * @returns 认证结果，包含 token
   * @throws USER_CANCEL 用户取消
   */
  login: async (): Promise<OneClickLoginResult> => {
    // TODO: 替换为真实 SDK 调用
    // 阿里云号码认证 SDK 示例：
    // const result = await AlibabaAuth.login();
    // return { token: result.token, phoneNumber: result.phoneNumber };
    console.warn('[AliOneClickModule] 桩实现：login 抛出错误，请接入真实 SDK');
    throw Object.assign(new Error('请先接入阿里云一键登录 SDK'), {
      code: AliLoginErrorCodes.NOT_INITIALIZED,
    });
  },

  /**
   * 退出登录，释放 SDK 资源
   */
  quit: async (): Promise<void> => {
    // TODO: 替换为真实 SDK 调用
    // 阿里云号码认证 SDK 示例：
    // await AlibabaAuth.quit();
    console.warn('[AliOneClickModule] 桩实现：quit 无实际效果');
  },
};

export default AliOneClickModule;
