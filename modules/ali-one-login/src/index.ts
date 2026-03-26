/**
 * ali-one-login 模块统一导出
 *
 * 对外提供统一的导入入口，简化调用方代码
 *
 * 使用示例：
 * ```typescript
 * import { AliOneClickModule, type OneClickLoginResult } from '@/modules/ali-one-login';
 *
 * const result = await AliOneClickModule.login();
 * ```
 */

export { default as AliOneClickModule } from './AliOneClickModule';
export type { FusionLoginResult } from './AliOneClickModule';
export { AliLoginErrorCodes } from './AliOneClickModule';
