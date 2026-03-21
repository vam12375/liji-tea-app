import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { seasonalPicks } from "@/data/articles";

export default function SeasonalPicks() {
  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-2">
        <View className="w-7 h-7 rounded-full bg-tertiary-fixed items-center justify-center">
          <MaterialIcons name="eco" size={16} color={Colors.tertiary} />
        </View>
        <View>
          <Text className="font-headline text-on-surface text-base font-bold">节气 · 春分</Text>
          <Text className="text-on-surface-variant text-[10px]">春分宜饮</Text>
        </View>
      </View>
      <View className="gap-3">
        {seasonalPicks.map((pick) => (
          <Pressable key={pick.name} className="flex-row items-center gap-3 active:opacity-80">
            <Image source={{ uri: pick.image }} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" />
            <View className="flex-1 gap-0.5">
              <Text className="text-on-surface text-sm font-bold">{pick.name}</Text>
              <Text className="text-on-surface-variant text-xs">{pick.desc}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
