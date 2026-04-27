import { View, Text, Pressable } from "react-native";

const DEFAULT_TABS = ["推荐", "问答", "冲泡"] as const;

interface Props {
  selected: string;
  onSelect: (tab: string) => void;
  tabs?: readonly string[];
}

export default function CommunityTabs({
  selected,
  onSelect,
  tabs = DEFAULT_TABS,
}: Props) {
  return (
    <View className="flex-row gap-6 px-1 flex-wrap">
      {tabs.map((tab) => (
        <Pressable
          key={tab}
          onPress={() => onSelect(tab)}
          className="pb-2 relative"
        >
          <Text
            className={`text-base ${
              selected === tab
                ? "text-on-surface font-bold"
                : "text-secondary/60"
            }`}
          >
            {tab}
          </Text>
          {selected === tab ? (
            <View className="absolute bottom-0 left-0 right-0 h-1 bg-primary-container rounded-full" />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
