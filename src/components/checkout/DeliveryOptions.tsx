import { View, Text, Pressable } from "react-native";

const OPTIONS = [
  { id: "standard", label: "标准配送 (3-5天)", price: 0 },
  { id: "express", label: "顺丰加急 (1-2天)", price: 15 },
] as const;

interface DeliveryOptionsProps {
  selected: string;
  onSelect: (id: string) => void;
}

export default function DeliveryOptions({ selected, onSelect }: DeliveryOptionsProps) {
  return (
    <View className="gap-3">
      <Text className="font-headline text-on-surface text-base">配送方式</Text>
      {OPTIONS.map((opt) => (
        <Pressable
          key={opt.id}
          onPress={() => onSelect(opt.id)}
          className="flex-row justify-between items-center py-2"
        >
          <View className="flex-row items-center gap-3">
            <View
              className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                selected === opt.id ? "border-primary-container" : "border-outline-variant"
              }`}
            >
              {selected === opt.id && (
                <View className="w-2.5 h-2.5 rounded-full bg-primary-container" />
              )}
            </View>
            <Text className="text-on-surface text-sm">{opt.label}</Text>
          </View>
          <Text className="text-outline text-sm">
            {opt.price === 0 ? "免费" : `¥${opt.price}`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
