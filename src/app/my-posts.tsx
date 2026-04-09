import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { Stack,useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import PostCard from "@/components/community/PostCard";
import { Colors } from "@/constants/Colors";
import { routes } from "@/lib/routes";
import { useCommunityStore } from "@/stores/communityStore";

export default function MyPostsScreen() {
  const router = useRouter();
  const posts = useCommunityStore((s) => s.posts);
  const fetchMyPosts = useCommunityStore((s) => s.fetchMyPosts);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
void fetchMyPosts();
  }, [fetchMyPosts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyPosts();
    setRefreshing(false);
  }, [fetchMyPosts]);

  return(
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "我的帖子",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft:() => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
/>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 py-3">
            <PostCard post={item} />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <MaterialIcons name="article" size={56} color={Colors.outlineVariant} />
            <Text className="text-outline text-sm mt-3">还没有发布过帖子</Text>
            <Pressable
              onPress={() => router.push(routes.communityCreate())}
              className="mt-4 bg-primary-container rounded-full px-6 py-2.5 active:bg-primary"
            >
              <Text className="text-on-primary font-medium">去发帖</Text>
            </Pressable>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
