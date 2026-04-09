/** UUID 采用 8-4-4-4-12 的十六进制格式，用于基础请求参数校验。 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 统一判断字符串是否符合 UUID 格式，避免把无效值传入数据库层。 */
export function isUuidLike(value: string) {
  return UUID_PATTERN.test(value);
}

