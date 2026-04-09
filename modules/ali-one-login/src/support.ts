export interface AliOneClickSupportOptions {
  platform: string;
  hasNativeModule: boolean;
}

/**
 * 一键登录仅在 Android 且原生模块可用时开放。
 */
export function isAliOneClickSupported(
  options: AliOneClickSupportOptions,
): boolean {
  return options.platform === "android" && options.hasNativeModule;
}
