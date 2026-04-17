/**
 * 商家端专属色板。
 *
 * 作用域：仅 src/app/merchant/* 与 src/components/merchant/*。
 * 与 C 端的 Colors.ts 并存，不替换、不注入全局。
 *
 * 语义色命名（而非视觉名）：方便后续换肤或做深色模式时只替换 token。
 */
export const MerchantColors = {
  // Ink / Paper 基础灰阶
  ink900: "#0e1411", // 大号数字 / 页面标题
  ink500: "#5a655c", // 副标题
  paper: "#faf6ee",  // 卡片底（比全局 background 白一点）
  line: "#e6dfd1",   // 描边 / 分隔线

  // 语义状态色
  statusWait: "#a77432", // 琥珀：待发货 / 待审核
  statusGo: "#4d7a4f",   // 茶青：进行中
  statusDone: "#6b6b6b", // 墨灰：已完成
  statusStop: "#a53b3b", // 朱砂：已拒绝 / 已取消
} as const;

export type MerchantColorKey = keyof typeof MerchantColors;
