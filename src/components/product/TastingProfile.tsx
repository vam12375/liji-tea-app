import { View, Text } from "react-native";
import type { TastingProfile as TastingProfileType } from "@/data/products";

interface TastingProfileProps {
  items: TastingProfileType[];
}

export default function TastingProfile({ items }: TastingProfileProps) {
  return (
    <View className="gap-4">
      <Text className="font-headline text-lg text-on-surface">风味赏析</Text>
      <View className="gap-5">
        {items.map((item) => (
          <View key={item.label} className="gap-2">
            <View className="flex-row justify-between items-center">
              <Text className="text-on-surface text-sm font-medium">
                {item.label}
              </Text>
              <Text className="text-outline text-xs">{item.description}</Text>
            </View>
            {/* 进度条 */}
            <View className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <View
                className="h-full bg-primary-container rounded-full"
                style={{ width: `${item.value}%` }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
