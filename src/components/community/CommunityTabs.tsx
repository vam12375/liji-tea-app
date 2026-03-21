import { View, Text, Pressable } from "react-native";

const TABS = ["动态", "话题", "茶会"] as const;

interface Props {
  selected: string;
  onSelect: (tab: string) => void;
}

export default function CommunityTabs({ selected, onSelect }: Props) {
  return (
    <View className="flex-row gap-6 px-1">
      {TABS.map((tab) => (
        <Pressable key={tab} onPress={() => onSelect(tab)} className="pb-2 relative">
          <Text className={`text-base ${selected === tab ? "text-on-surface font-bold" : "text-secondary/60"}`}>
            {tab}
          </Text>
          {selected === tab && (
            <View className="absolute bottom-0 left-0 right-0 h-1 bg-primary-container rounded-full" />
          )}
        </Pressable>
      ))}
    </View>
  );
}
