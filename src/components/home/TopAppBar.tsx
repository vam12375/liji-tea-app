import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";

export default function TopAppBar() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-background/70 px-6 pb-3"
    >
      <View className="flex-row justify-between items-center h-14">
        {/* 左侧 - Logo */}
        <View className="flex-row items-center gap-3">
          <MaterialIcons name="menu" size={24} color={Colors.primary} />
          <Text className="font-headline text-2xl tracking-widest font-bold text-primary">
            李记茶
          </Text>
        </View>

        {/* 右侧 - 功能图标 */}
        <View className="flex-row items-center gap-4">
          <Pressable hitSlop={8}>
            <MaterialIcons name="search" size={24} color={Colors.primary} />
          </Pressable>
          <Pressable hitSlop={8}>
            <MaterialIcons name="notifications-none" size={24} color={Colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
