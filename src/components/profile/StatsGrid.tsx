import { View, Text, Pressable } from "react-native";

const STATS = [
  { label: "收藏", value: 12 },
  { label: "足迹", value: 48 },
  { label: "关注", value: 6 },
  { label: "粉丝", value: 23 },
];

export default function StatsGrid() {
  return (
    <View className="flex-row px-4 py-3">
      {STATS.map((stat) => (
        <Pressable
          key={stat.label}
          className="flex-1 items-center gap-1 active:opacity-60"
        >
          <Text className="text-on-surface text-lg font-bold">{stat.value}</Text>
          <Text className="text-outline text-xs">{stat.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
