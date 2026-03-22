import { View, Text, Pressable } from "react-native";
import { useUserStore } from "@/stores/userStore";

export default function StatsGrid() {
  // 从 store 读取收藏列表
  const favorites = useUserStore((s) => s.favorites);

  // 动态统计数据（足迹/关注/粉丝暂无对应 store，显示 0）
  const STATS = [
    { label: "收藏", value: favorites.length },
    { label: "足迹", value: 0 },
    { label: "关注", value: 0 },
    { label: "粉丝", value: 0 },
  ];

  return (
    <View className="flex-row px-4 py-3">
      {STATS.map((stat) => (
        <Pressable
          key={stat.label}
          className="flex-1 items-center gap-1 active:opacity-60"
        >
          <Text className="text-on-surface text-lg font-bold">
            {stat.value > 0 ? stat.value : "—"}
          </Text>
          <Text className="text-outline text-xs">{stat.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
