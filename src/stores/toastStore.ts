import { create } from "zustand";

// 全局 Toast 类型：
// - kind 控制色/icon 语义（成功/错误/提示）
// - scope 控制视觉主题：商家端使用 MerchantColors 的 ink/paper；C 端使用 Colors 主色
// 单 slot 策略：同一时刻只保留一条，新消息替换旧消息，保持视觉纯净。
export type ToastKind = "success" | "error" | "info";
export type ToastScope = "customer" | "merchant";

export interface Toast {
  id: number;
  scope: ToastScope;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface State {
  current: Toast | null;
  sequence: number;
}

interface Actions {
  push: (payload: Omit<Toast, "id">) => void;
  dismiss: () => void;
  _reset: () => void;
}

// 自增 sequence 便于视图层捕获"同一条 Toast 是否已被新消息替换"。
export const useToastStore = create<State & Actions>((set) => ({
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

// 便捷 API：页面内直接调用，避免每次手动获取 store 状态。
export function pushToast(payload: Omit<Toast, "id">) {
  useToastStore.getState().push(payload);
}

export function dismissToast() {
  useToastStore.getState().dismiss();
}

export function getToastState() {
  return useToastStore.getState();
}

export function resetToastStore() {
  useToastStore.getState()._reset();
}
