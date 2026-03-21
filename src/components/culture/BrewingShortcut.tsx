import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

export default function BrewingShortcut() {
  return (
    <Pressable className="bg-primary-container/10 border border-primary/5 rounded-2xl p-5 flex-row items-center justify-between active:opacity-80">
      <View className="flex-1 gap-1">
        <Text className="font-headline text-on-surface text-base font-bold">冲泡指南</Text>
        <Text className="text-on-surface-variant text-xs">掌握每一款茶的最佳冲泡方式</Text>
      </View>
      <View className="w-12 h-12 bg-primary-container/20 rounded-full items-center justify-center">
        <MaterialIcons name="coffee-maker" size={28} color={Colors.primaryContainer} />
      </View>
    </Pressable>
  );
}
