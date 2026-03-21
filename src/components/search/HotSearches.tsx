import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

interface Props {
  items: string[];
  onSelect: (term: string) => void;
}

export default function HotSearches({ items, onSelect }: Props) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-1">
        <MaterialIcons name="trending-up" size={18} color={Colors.tertiary} />
        <Text className="text-on-surface font-medium text-sm">热门搜索</Text>
      </View>
      <View className="flex-row flex-wrap gap-y-4 gap-x-6">
        {items.map((item, i) => (
          <Pressable key={item} onPress={() => onSelect(item)} className="flex-row items-center gap-2 w-[45%]">
            {i < 3 ? (
              <View className="w-5 h-5 rounded-full bg-tertiary-fixed items-center justify-center">
                <Text className="text-on-surface text-[10px] font-bold">{i + 1}</Text>
              </View>
            ) : (
              <Text className="text-on-surface-variant/40 text-xs w-5 text-center">{i + 1}</Text>
            )}
            <Text className="text-on-surface text-sm">{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
