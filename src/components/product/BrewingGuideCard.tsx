import { View, Text } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { BrewingGuide } from "@/data/products";

const GUIDE_ITEMS = [
  { key: "temperature" as const, icon: "thermostat" as const, label: "水温" },
  { key: "time" as const, icon: "timer" as const, label: "时间" },
  { key: "amount" as const, icon: "scale" as const, label: "用量" },
  { key: "equipment" as const, icon: "coffee-maker" as const, label: "器具" },
];

interface BrewingGuideCardProps {
  guide: BrewingGuide;
}

export default function BrewingGuideCard({ guide }: BrewingGuideCardProps) {
  return (
    <View className="gap-4">
      <Text className="font-headline text-lg text-on-surface">冲泡指南</Text>
      <View className="flex-row flex-wrap gap-3">
        {GUIDE_ITEMS.map((item) => (
          <View
            key={item.key}
            className="flex-1 min-w-[45%] bg-surface-container-low rounded-xl p-4 items-center gap-2"
          >
            <MaterialIcons
              name={item.icon}
              size={28}
              color={Colors.primaryContainer}
            />
            <Text className="text-outline text-xs">{item.label}</Text>
            <Text className="text-on-surface font-medium text-sm">
              {guide[item.key]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
