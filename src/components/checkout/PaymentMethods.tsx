import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { Colors } from "@/constants/Colors";
import {
  getEnabledPaymentChannels,
  paymentChannelConfig,
  paymentEnvironment,
} from "@/lib/paymentConfig";
import type { PaymentChannel } from "@/types/payment";

// 支付方式展示元数据：是否真实支付由配置决定，这里只负责 UI 层描述。
const METHOD_META = {
  alipay: {
    label: "支付宝",
    icon: "payments" as const,
    color: "#1677FF",
    mockDescription: "当前环境未启用支付宝 App 支付。",
    realDescription:
      paymentEnvironment === "sandbox"
        ? "走支付宝沙箱 App 支付链路。"
        : "走支付宝正式 App 支付链路。",
  },
  wechat: {
    label: "微信支付",
    icon: "account-balance-wallet" as const,
    color: "#07C160",
    mockDescription: "当前为后端模拟支付链路。",
    realDescription: "走微信支付正式链路。",
  },
  card: {
    label: "银行卡",
    icon: "credit-card" as const,
    color: Colors.secondaryContainer,
    mockDescription: "当前为后端模拟支付链路。",
    realDescription: "走银行卡正式支付链路。",
  },
} as const satisfies Record<
  PaymentChannel,
  {
    label: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    color: string;
    mockDescription: string;
    realDescription: string;
  }
>;

// 结算页只传当前选中值和切换回调，渠道可用性由组件内部读取配置决定。
interface PaymentMethodsProps {
  selected: PaymentChannel;
  onSelect: (id: PaymentChannel) => void;
}

// 仅渲染当前环境已启用的支付渠道，避免用户选到不可用方案。
export default function PaymentMethods({
  selected,
  onSelect,
}: PaymentMethodsProps) {
  const enabledChannels = getEnabledPaymentChannels();

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="font-headline text-on-surface text-base">
          支付方式
        </Text>
        <Text className="text-outline text-xs">
          只展示当前环境已启用的渠道；模拟渠道会在说明中明确标记。
        </Text>
      </View>

      {enabledChannels.length === 0 ? (
        <View className="rounded-xl bg-surface-container-low px-4 py-3">
          <Text className="text-outline text-sm">
            当前环境未启用任何支付渠道，请先检查环境变量配置。
          </Text>
        </View>
      ) : (
        // 逐个根据配置渲染可用渠道，并在说明中明确区分真实链路与模拟链路。
        enabledChannels.map((channel) => {
          const meta = METHOD_META[channel];
          const config = paymentChannelConfig[channel];

          return (
            <Pressable
              key={channel}
              onPress={() => onSelect(channel)}
              className="flex-row items-center gap-3 py-2"
            >
              <View
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: `${meta.color}20` }}
              >
                <MaterialIcons name={meta.icon} size={18} color={meta.color} />
              </View>
              <View className="flex-1">
                <Text className="text-on-surface text-sm">{meta.label}</Text>
                <Text className="text-outline text-xs mt-0.5">
                  {config.isMock ? meta.mockDescription : meta.realDescription}
                </Text>
              </View>
              <View
                className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  selected === channel
                    ? "border-primary-container"
                    : "border-outline-variant"
                }`}
              >
                {selected === channel ? (
                  <View className="w-2.5 h-2.5 rounded-full bg-primary-container" />
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
