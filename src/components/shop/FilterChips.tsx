import { ScrollView, Pressable, Text } from "react-native";
import { TEA_CATEGORIES, type TeaCategory } from "@/data/products";

interface FilterChipsProps {
  selected: TeaCategory;
  onSelect: (category: TeaCategory) => void;
}

export default function FilterChips({ selected, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-1"
    >
      {TEA_CATEGORIES.map((cat) => (
        <Pressable
          key={cat}
          onPress={() => onSelect(cat)}
          className={`px-4 py-2 rounded-full ${
            selected === cat
              ? "bg-primary-container"
              : "border border-outline-variant"
          }`}
        >
          <Text
            className={`text-sm ${
              selected === cat
                ? "text-on-primary font-medium"
                : "text-on-surface-variant"
            }`}
          >
            {cat}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
