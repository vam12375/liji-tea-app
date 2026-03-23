import { create } from "zustand";

/** 弹窗按钮配置 */
export interface ModalAction {
  text: string;
  /** 按钮风格: primary=实心主色, cancel=文字灰色, destructive=文字红色 */
  style?: "primary" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
}

/** 弹窗图标类型 — 决定顶部圆形图标 */
export type ModalIcon =
  | "info"      // 提示/占位
  | "success"   // 成功
  | "error"     // 错误
  | "confirm"   // 确认操作
  | "cart"      // 购物车
  | "logout"    // 退出
  | "delete"    // 删除
  | "order";    // 订单

/** 弹窗配置 */
export interface ModalConfig {
  title: string;
  message: string;
  icon?: ModalIcon;
  /** 详情区域（可选），如订单金额 */
  detail?: { label: string; value: string };
  /** 按钮列表，默认只有一个"知道了"按钮 */
  actions?: ModalAction[];
}

interface ModalState {
  visible: boolean;
  config: ModalConfig | null;
  /** 显示弹窗 */
  show: (config: ModalConfig) => void;
  /** 关闭弹窗 */
  hide: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  visible: false,
  config: null,
  show: (config) => set({ visible: true, config }),
  hide: () => set({ visible: false, config: null }),
}));

/**
 * 便捷方法：显示简单提示弹窗（替代 Alert.alert(title, message)）
 */
export function showModal(title: string, message: string, icon?: ModalIcon) {
  useModalStore.getState().show({ title, message, icon: icon ?? "info" });
}

/**
 * 便捷方法：显示确认弹窗（替代 Alert.alert(title, message, [cancel, confirm])）
 */
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  options?: {
    icon?: ModalIcon;
    confirmText?: string;
    cancelText?: string;
    confirmStyle?: "primary" | "destructive";
    detail?: { label: string; value: string };
  }
) {
  useModalStore.getState().show({
    title,
    message,
    icon: options?.icon ?? "confirm",
    detail: options?.detail,
    actions: [
      {
        text: options?.confirmText ?? "确认",
        style: options?.confirmStyle ?? "primary",
        onPress: onConfirm,
      },
      {
        text: options?.cancelText ?? "取消",
        style: "cancel",
      },
    ],
  });
}
