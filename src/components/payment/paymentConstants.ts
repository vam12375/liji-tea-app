import type MaterialIcons from "@expo/vector-icons/MaterialIcons";

import type { PaymentChannel } from "@/types/payment";

// 页面展示层使用的支付方式元数据，和实际支付渠道枚举一一对应。
export const PAYMENT_MAP = {
  wechat: {
    label: "微信支付",
    icon: "account-balance-wallet" as const,
    color: "#07C160",
  },
  alipay: {
    label: "支付宝",
    icon: "payments" as const,
    color: "#1677FF",
  },
  card: {
    label: "银行卡",
    icon: "credit-card" as const,
    color: "#715B3E",
  },
} satisfies Record<
  PaymentChannel,
  {
    label: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    color: string;
  }
>;

// 支付页按阶段驱动 UI：确认、创建支付单、唤起 SDK、等待服务端确认、成功、失败。
export type PaymentPhase =
  | "confirm"
  | "creating_order"
  | "invoking_sdk"
  | "waiting_confirm"
  | "success"
  | "failed";

// 处理中各阶段的提示文案，避免在渲染层分散写死字符串。
export const PROCESSING_PHASE_TEXT: Record<
  Exclude<PaymentPhase, "confirm" | "success" | "failed">,
  string
> = {
  creating_order: "正在向服务端创建支付单...",
  invoking_sdk: "正在唤起支付客户端...",
  waiting_confirm: "支付已发起，正在等待服务端确认...",
};
