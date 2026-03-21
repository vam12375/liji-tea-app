import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

const METHODS = [
  { id: "wechat", label: "微信支付", icon: "account-balance-wallet" as const, color: "#07C160" },
  { id: "alipay", label: "支付宝", icon: "payments" as const, color: "#1677FF" },
  { id: "card", label: "银行卡", icon: "credit-card" as const, color: Colors.secondaryContainer },
] as const;

interface PaymentMethodsProps {
  selected: string;
  onSelect: (id: string) => void;
}

export default function PaymentMethods({ selected, onSelect }: PaymentMethodsProps) {
  return (
    <View className="gap-3">
      <Text className="font-headline text-on-surface text-base">支付方式</Text>
      {METHODS.map((method) => (
        <Pressable
          key={method.id}
          onPress={() => onSelect(method.id)}
          className="flex-row items-center gap-3 py-2"
        >
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: method.color + "20" }}
          >
            <MaterialIcons name={method.icon} size={18} color={method.color} />
          </View>
          <Text className="flex-1 text-on-surface text-sm">{method.label}</Text>
          <View
            className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
              selected === method.id ? "border-primary-container" : "border-outline-variant"
            }`}
          >
            {selected === method.id && (
              <View className="w-2.5 h-2.5 rounded-full bg-primary-container" />
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
