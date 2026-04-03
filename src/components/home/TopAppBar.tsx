import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import { showModal } from "@/stores/modalStore";

export default function TopAppBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-background/70 px-6 pb-3"
    >
      <View className="flex-row justify-between items-center h-14">
        {/* 左侧 - 品牌标识 */}
        <View className="flex-row items-center">
          <Text className="font-headline text-2xl tracking-widest font-bold text-primary">
            李记茶
          </Text>
        </View>

        {/* 右侧 - 功能图标 */}
        <View className="flex-row items-center gap-4">
          <Pressable hitSlop={8} onPress={() => router.push("/search")}>
            <MaterialIcons name="search" size={24} color={Colors.primary} />
          </Pressable>
          {/* 通知入口 — 功能即将上线 */}
          <Pressable
            hitSlop={8}
            onPress={() => showModal("提示", "消息通知功能即将上线")}
          >
            <MaterialIcons name="notifications-none" size={24} color={Colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
