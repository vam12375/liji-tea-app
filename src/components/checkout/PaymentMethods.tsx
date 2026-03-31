import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { PaymentChannel } from "@/types/payment";

const METHODS = [
  {
    id: "alipay",
    label: "支付宝",
    icon: "payments" as const,
    color: "#1677FF",
    enabled: true,
    description: "调用支付宝沙箱支付",
  },
  {
    id: "wechat",
    label: "微信支付",
    icon: "account-balance-wallet" as const,
    color: "#07C160",
    enabled: true,
    description: "当前为后端模拟支付",
  },
  {
    id: "card",
    label: "银行卡",
    icon: "credit-card" as const,
    color: Colors.secondaryContainer,
    enabled: true,
    description: "当前为后端模拟支付",
  },
] as const;

interface PaymentMethodsProps {
  selected: PaymentChannel;
  onSelect: (id: PaymentChannel) => void;
}

export default function PaymentMethods({ selected, onSelect }: PaymentMethodsProps) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="font-headline text-on-surface text-base">支付方式</Text>
        <Text className="text-outline text-xs">
          支付宝走沙箱支付，微信支付与银行卡走后端模拟支付。
        </Text>
      </View>

      {METHODS.map((method) => (
        <Pressable
          key={method.id}
          onPress={() => method.enabled && onSelect(method.id)}
          className={`flex-row items-center gap-3 py-2 ${
            method.enabled ? "" : "opacity-45"
          }`}
        >
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: method.color + "20" }}
          >
            <MaterialIcons name={method.icon} size={18} color={method.color} />
          </View>
          <View className="flex-1">
            <Text className="text-on-surface text-sm">{method.label}</Text>
            <Text className="text-outline text-xs mt-0.5">{method.description}</Text>
          </View>
          <View
            className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
              selected === method.id && method.enabled
                ? "border-primary-container"
                : "border-outline-variant"
            }`}
          >
            {selected === method.id && method.enabled && (
              <View className="w-2.5 h-2.5 rounded-full bg-primary-container" />
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
