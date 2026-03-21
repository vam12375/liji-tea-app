import { ScrollView, Pressable, Text } from "react-native";
import { CULTURE_CATEGORIES, type CultureCategory } from "@/data/articles";

interface CategoryTabsProps {
  selected: CultureCategory;
  onSelect: (cat: CultureCategory) => void;
}

export default function CategoryTabs({ selected, onSelect }: CategoryTabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-6 px-1">
      {CULTURE_CATEGORIES.map((cat) => (
        <Pressable key={cat} onPress={() => onSelect(cat)} className="pb-2">
          <Text className={`text-sm ${selected === cat ? "text-on-surface font-bold border-b-2 border-on-surface pb-1" : "text-secondary/70"}`}>
            {cat}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
