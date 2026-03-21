import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

interface Props {
  items: string[];
  onClear: () => void;
  onSelect: (term: string) => void;
}

export default function SearchHistoryChips({ items, onClear, onSelect }: Props) {
  if (items.length === 0) return null;
  return (
    <View className="gap-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-on-surface font-medium text-sm">搜索历史</Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <MaterialIcons name="delete-outline" size={18} color={Colors.outline} />
        </Pressable>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <Pressable key={item} onPress={() => onSelect(item)} className="bg-surface-container-low px-4 py-1.5 rounded-full">
            <Text className="text-on-surface-variant text-sm">{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
