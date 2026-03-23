import { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  useAnimatedValue,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import {
  useModalStore,
  type ModalIcon,
  type ModalAction,
} from "@/stores/modalStore";

/** 图标类型 → MaterialIcons 名称映射 */
const ICON_MAP: Record<ModalIcon, React.ComponentProps<typeof MaterialIcons>["name"]> = {
  info: "info",
  success: "check-circle",
  error: "error",
  confirm: "help-outline",
  cart: "shopping-cart",
  logout: "logout",
  delete: "delete-outline",
  order: "receipt-long",
};

/** 图标类型 → 圆形背景色 */
const ICON_BG: Record<ModalIcon, string> = {
  info: "bg-primary-fixed",
  success: "bg-primary-fixed",
  error: "bg-error-container",
  confirm: "bg-primary-fixed",
  cart: "bg-primary-fixed",
  logout: "bg-error-container",
  delete: "bg-error-container",
  order: "bg-tertiary-fixed",
};

/** 图标类型 → 图标颜色 */
const ICON_COLOR: Record<ModalIcon, string> = {
  info: Colors.primary,
  success: Colors.primary,
  error: Colors.error,
  confirm: Colors.primary,
  cart: Colors.primary,
  logout: Colors.error,
  delete: Colors.error,
  order: Colors.tertiary,
};

/**
 * TeaModal — 符合"The Ethereal Steep"设计系统的全局弹窗组件
 *
 * 设计参考: Stitch 生成的 code.html
 * - 毛玻璃半透明遮罩
 * - 圆角卡片 + 茶叶纹理装饰
 * - Serif 标题 + 圆形图标
 * - 全宽圆角按钮
 */
export default function TeaModal() {
  const visible = useModalStore((s) => s.visible);
  const config = useModalStore((s) => s.config);
  const hide = useModalStore((s) => s.hide);

  // 默认按钮：单个"知道了"
  const actions: ModalAction[] = config?.actions ?? [
    { text: "知道了", style: "primary" },
  ];

  const icon: ModalIcon = config?.icon ?? "info";

  /** 按钮点击处理 */
  const handleAction = useCallback(
    async (action: ModalAction) => {
      if (action.onPress) {
        await action.onPress();
      }
      hide();
    },
    [hide]
  );

  if (!config) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={hide}
    >
      {/* 遮罩层 */}
      <Pressable
        onPress={hide}
        className="flex-1 items-center justify-center bg-black/40 px-8"
      >
        {/* 弹窗卡片 — 阻止冒泡 */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-background rounded-3xl overflow-hidden"
          style={{
            shadowColor: Colors.onSurface,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          {/* 茶叶纹理装饰（右上角） */}
          <View className="absolute -top-3 -right-3 opacity-10">
            <MaterialIcons name="eco" size={72} color={Colors.primary} />
          </View>

          {/* 主内容区 */}
          <View className="items-center px-8 pt-10 pb-8">
            {/* 圆形图标 */}
            <View
              className={`w-16 h-16 rounded-full items-center justify-center mb-6 ${ICON_BG[icon]}`}
            >
              <MaterialIcons
                name={ICON_MAP[icon]}
                size={28}
                color={ICON_COLOR[icon]}
              />
            </View>

            {/* 标题 */}
            <Text className="font-headline text-2xl font-bold text-on-surface tracking-wider mb-3">
              {config.title}
            </Text>

            {/* 描述 */}
            <Text className="text-on-surface-variant text-base leading-relaxed text-center px-2">
              {config.message}
            </Text>

            {/* 详情区域（可选） */}
            {config.detail && (
              <View className="mt-6 mb-2 w-full bg-surface-container-low rounded-2xl p-4 flex-row justify-between items-center">
                <Text className="text-secondary text-xs tracking-widest uppercase">
                  {config.detail.label}
                </Text>
                <Text className="font-headline text-xl text-primary font-bold">
                  {config.detail.value}
                </Text>
              </View>
            )}

            {/* 按钮区域 */}
            <View className="w-full mt-8 gap-3">
              {actions.map((action, index) => {
                // 第一个按钮为主要操作（实心），其余为文字按钮
                const isPrimary = action.style === "primary";
                const isDestructive = action.style === "destructive";
                const isCancel = action.style === "cancel";

                if (isPrimary || isDestructive) {
                  return (
                    <Pressable
                      key={index}
                      onPress={() => handleAction(action)}
                      className={`w-full py-4 rounded-full items-center active:opacity-80 ${
                        isDestructive
                          ? "bg-error"
                          : "bg-primary-container"
                      }`}
                      style={
                        !isDestructive
                          ? {
                              shadowColor: Colors.primary,
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.2,
                              shadowRadius: 8,
                              elevation: 4,
                            }
                          : undefined
                      }
                    >
                      <Text
                        className={`font-bold text-base ${
                          isDestructive
                            ? "text-on-error"
                            : "text-on-primary-container"
                        }`}
                      >
                        {action.text}
                      </Text>
                    </Pressable>
                  );
                }

                // 文字按钮（取消等）
                return (
                  <Pressable
                    key={index}
                    onPress={() => handleAction(action)}
                    className="w-full py-3 items-center active:opacity-60"
                  >
                    <Text className="text-secondary text-base font-medium">
                      {action.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 底部装饰（左下角） */}
          <View className="absolute -bottom-4 -left-4 opacity-5 rotate-45">
            <MaterialIcons name="local-cafe" size={64} color={Colors.secondary} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
