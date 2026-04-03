import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { ComponentProps } from "react";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

interface Category {
  label: string;
  icon: IconName;
}

/** 茶类分类数据 */
const CATEGORIES: Category[] = [
  { label: "岩茶", icon: "energy-savings-leaf" },
  { label: "绿茶", icon: "eco" },
  { label: "白茶", icon: "spa" },
  { label: "红茶", icon: "coffee" },
  { label: "乌龙", icon: "grass" },
  { label: "普洱", icon: "local-cafe" },
  { label: "花茶", icon: "local-florist" },
];

export default function CategoryRow() {
  const router = useRouter();

  /** 点击分类 → 跳转商城页并带上分类筛选参数 */
  const handleCategoryPress = (label: string) => {
    router.push({ pathname: "/(tabs)/shop", params: { category: label } });
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-6 px-1"
    >
      {CATEGORIES.map((cat) => (
        <Pressable
          key={cat.label}
          className="items-center gap-2 active:opacity-70"
          onPress={() => handleCategoryPress(cat.label)}
        >
          <View className="w-14 h-14 rounded-full items-center justify-center bg-surface-container-high">
            <MaterialIcons
              name={cat.icon}
              size={24}
              color={Colors.secondary}
            />
          </View>
          <Text className="text-xs font-medium text-on-surface">
            {cat.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
