import { create } from "zustand";

// 商家端 Toast 类型：success（茶青）/ error（朱砂）/ info（墨灰）。
export type MerchantToastKind = "success" | "error" | "info";

export interface MerchantToast {
  id: number;
  kind: MerchantToastKind;
  title: string;
  detail?: string;
}

interface State {
  current: MerchantToast | null;
  sequence: number;
}

interface Actions {
  push: (payload: Omit<MerchantToast, "id">) => void;
  dismiss: () => void;
  _reset: () => void;
}

// 单 slot 策略：同一时刻只显示一条 Toast，避免堆栈干扰员工视线。
// 新 push 直接替换旧的；id 自增便于视图层捕获变化重启定时器。
export const useMerchantToastStore = create<State & Actions>((set) => ({
  current: null,
  sequence: 0,
  push: (payload) =>
    set((s) => ({
      current: { id: s.sequence + 1, ...payload },
      sequence: s.sequence + 1,
    })),
  dismiss: () => set({ current: null }),
  _reset: () => set({ current: null, sequence: 0 }),
}));

// 便捷 API：页面里直接调用，避免每次拿 store.getState()。
export function pushMerchantToast(payload: Omit<MerchantToast, "id">) {
  useMerchantToastStore.getState().push(payload);
}
export function dismissMerchantToast() {
  useMerchantToastStore.getState().dismiss();
}
export function getMerchantToastState() {
  return useMerchantToastStore.getState();
}
export function resetMerchantToastStore() {
  useMerchantToastStore.getState()._reset();
}
