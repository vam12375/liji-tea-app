// 客户端统一的商家角色枚举。
// - guest：普通顾客（未在 user_roles 表登记）
// - staff：员工
// - admin：管理员
//
// 所有页面层只消费 userStore.role，禁止各自再查 user_roles，避免重复兜底逻辑。
export type UserRole = "guest" | "staff" | "admin";

// 将 Supabase 返回的 user_roles 行（可能为 null / 含未知 role）统一归一化为 UserRole 枚举。
// 保持纯函数，便于 tests 直接覆盖所有分支。
export function normalizeUserRole(
  row: { role?: string | null } | null | undefined,
): UserRole {
  const value = row?.role?.trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "staff") return "staff";
  return "guest";
}

// 便捷判定：是否属于商家端员工（admin 或 staff），供入口守卫与按钮可见性判断。
export function isMerchantStaff(role: UserRole) {
  return role === "admin" || role === "staff";
}
