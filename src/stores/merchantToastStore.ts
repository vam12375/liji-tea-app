// 向后兼容的薄 wrapper。真实状态已迁移到 src/stores/toastStore.ts。
// 商家端既有调用点（pushMerchantToast / dismissMerchantToast / useMerchantToastStore）
// 保持语义不变；scope 固定为 "merchant"，视觉由全局 Toast 组件按 scope 渲染。
//
// 保留这一层 wrapper 的原因：
// 1. 不强制 8 处业务代码一次性改签名，降低此次重构风险；
// 2. 单元测试（tests/merchantToast.test.ts）可以零改动继续跑；
// 3. 未来如决定全面切到 pushToast，可先通过 grep 按需替换。
import {
  dismissToast,
  getToastState,
  pushToast,
  resetToastStore,
  useToastStore,
  type Toast,
  type ToastKind,
} from "./toastStore";

export type MerchantToastKind = ToastKind;
export type MerchantToast = Toast;

// Toast store 的底层实例即为新的全局 store，保留旧引用名兼容现有组件/测试。
export const useMerchantToastStore = useToastStore;

export function pushMerchantToast(payload: {
  kind: ToastKind;
  title: string;
  detail?: string;
}) {
  pushToast({ scope: "merchant", ...payload });
}

export function dismissMerchantToast() {
  dismissToast();
}

export function getMerchantToastState() {
  return getToastState();
}

export function resetMerchantToastStore() {
  resetToastStore();
}
