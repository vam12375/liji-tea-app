import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import PostCard from "@/components/community/PostCard";
import { Colors } from "@/constants/Colors";
import { fetchSavedCommunityPosts } from "@/lib/communitySaved";
import type { Post } from "@/stores/communityStore";
import { useUserStore } from "@/stores/userStore";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "photo", label: "动态" },
  { key: "question", label: "问答" },
  { key: "brewing", label: "冲泡" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function CommunitySavedScreen() {
  const insets = useSafeAreaInsets();
  const session = useUserStore((state) => state.session);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const loadSavedPosts = useCallback(async () => {
    if (!session?.user?.id) {
      setSavedPosts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // 收藏页独立拉收藏关系，避免只依赖当前 feed 中已经加载的帖子。
      const posts = await fetchSavedCommunityPosts(session.user.id);
      setSavedPosts(posts);
    } catch (loadError: any) {
      setSavedPosts([]);
      setError(loadError?.message ?? "加载收藏内容失败");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    void loadSavedPosts();
  }, [loadSavedPosts]);

  const filteredPosts = useMemo(() => {
    if (filter === "all") {
      return savedPosts;
    }

    return savedPosts.filter((post) => post.type === filter);
  }, [filter, savedPosts]);

  if (!session) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-4 px-6">
        <MaterialIcons name="bookmark-border" size={28} color={Colors.outline} />
        <Text className="text-on-surface-variant text-base text-center">
          登录后才能查看社区收藏内容。
        </Text>
        <Pressable
          onPress={() => router.push("/login")}
          className="px-6 py-2 bg-primary rounded-full"
        >
          <Text className="text-white text-sm font-medium">去登录</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View
        style={{ paddingTop: insets.top }}
        className="px-4 pb-3 bg-background border-b border-outline-variant/10"
      >
        <View className="flex-row items-center h-12">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center active:opacity-60"
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color={Colors.onSurface}
            />
          </Pressable>
          <View className="flex-1 ml-2">
            <Text className="text-on-surface text-lg font-bold">社区收藏</Text>
            <Text className="text-outline text-[11px]">
              已收藏 {savedPosts.length} 条内容
            </Text>
          </View>
        </View>

        <View className="flex-row gap-2 mt-3">
          {FILTERS.map((item) => {
            const active = item.key === filter;

            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                className={`px-4 py-2 rounded-full border ${
                  active
                    ? "bg-primary border-primary"
                    : "bg-surface-container-low border-outline-variant/10"
                }`}
              >
                <Text
                  className={`text-xs ${
                    active ? "text-white font-medium" : "text-on-surface"
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 py-5 gap-4"
        renderItem={({ item }) => <PostCard post={item} />}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void loadSavedPosts()}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="rounded-3xl bg-surface-container-low px-5 py-6 items-center gap-2">
            <MaterialIcons name="bookmark-border" size={26} color={Colors.outline} />
            <Text className="text-on-surface-variant text-sm text-center leading-6">
              {error
                ? error
                : filter === "all"
                  ? "你还没有收藏任何社区内容。"
                  : "当前分类下还没有收藏内容。"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
