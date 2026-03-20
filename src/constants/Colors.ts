/**
 * "The Ethereal Steep" 设计系统 - 颜色 Token
 * 用于 TabBar、StatusBar 等需要 JS 值的场景
 * 样式中优先使用 Tailwind className
 */
export const Colors = {
  primary: "#435c3c",
  primaryContainer: "#5b7553",
  onPrimary: "#ffffff",

  secondary: "#715b3e",
  secondaryContainer: "#f9dbb7",
  onSecondary: "#ffffff",

  tertiary: "#6c521d",
  tertiaryContainer: "#876a33",

  background: "#fef9f1",
  onBackground: "#1d1c17",
  surface: "#fef9f1",
  onSurface: "#1d1c17",
  surfaceContainerLow: "#f8f3eb",
  surfaceContainer: "#f2ede5",

  outline: "#74796f",
  outlineVariant: "#c3c8bd",
} as const;
