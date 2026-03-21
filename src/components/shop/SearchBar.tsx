import { View, TextInput, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export default function SearchBar({ value, onChangeText }: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-surface-container-high rounded-full px-4 h-11 gap-2">
      <MaterialIcons name="search" size={20} color={Colors.outline} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="搜索茶品..."
        placeholderTextColor={Colors.outline}
        className="flex-1 text-on-surface text-sm font-body"
        returnKeyType="search"
      />
      <Pressable hitSlop={8}>
        <MaterialIcons name="photo-camera" size={20} color={Colors.outline} />
      </Pressable>
    </View>
  );
}
