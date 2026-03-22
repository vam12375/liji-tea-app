import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useCommunityStore } from "@/stores/communityStore";
import CommunityTabs from "@/components/community/CommunityTabs";
import StoryRow from "@/components/community/StoryRow";
import PostCard from "@/components/community/PostCard";

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("动态");
  const { posts, fetchPosts } = useCommunityStore();

  useEffect(() => {
    fetchPosts();
  }, []);

  return (
    <View className="flex-1 bg-background">
      {/* 顶部标题栏 */}
      <View style={{ paddingTop: insets.top }} className="px-6 pb-3 bg-background/70">
        <View className="flex-row justify-between items-center h-14">
          <Text className="font-headline text-2xl text-on-surface font-bold">茶友</Text>
          <Pressable hitSlop={8}>
            <MaterialIcons name="edit-note" size={24} color={Colors.onSurface} />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 gap-6" showsVerticalScrollIndicator={false}>
        <CommunityTabs selected={tab} onSelect={setTab} />
        <StoryRow />
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </ScrollView>

      {/* FAB */}
      <Pressable
        className="absolute bottom-24 right-6 w-14 h-14 bg-primary-container rounded-full items-center justify-center active:scale-95"
        style={{ elevation: 8 }}
      >
        <MaterialIcons name="add" size={28} color={Colors.onPrimary} />
      </Pressable>
    </View>
  );
}
