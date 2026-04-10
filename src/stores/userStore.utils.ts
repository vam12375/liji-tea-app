// userStore 内部统一把未知异常转成用户可展示文案，避免每个模块重复写兜底。
export function getUserStoreErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
