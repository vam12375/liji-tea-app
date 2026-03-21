import { View, Text, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { stories } from "@/data/community";

export default function StoryRow() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4 px-1">
      {/* 我的故事 */}
      <Pressable className="items-center gap-1">
        <View className="w-14 h-14 rounded-full border-2 border-dashed border-outline-variant bg-surface-container items-center justify-center">
          <MaterialIcons name="add" size={22} color={Colors.primary} />
        </View>
        <Text className="text-on-surface text-[10px] font-medium">我的</Text>
      </Pressable>

      {/* 用户故事 */}
      {stories.map((story) => (
        <Pressable key={story.id} className="items-center gap-1">
          <View className={`p-[2px] rounded-full border-2 ${story.isViewed ? "border-outline-variant/30" : "border-tertiary-fixed"}`}>
            <Image source={{ uri: story.avatar }} style={{ width: 48, height: 48, borderRadius: 9999 }} contentFit="cover" />
          </View>
          <Text className="text-on-surface text-[10px] font-medium" numberOfLines={1}>{story.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
