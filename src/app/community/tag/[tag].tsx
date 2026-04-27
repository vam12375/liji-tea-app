import { useEffect, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import PostCard from "@/components/community/PostCard";
import ArticleCard from "@/components/culture/ArticleCard";
import { Colors } from "@/constants/Colors";
import {
  articleMatchesTag,
  postMatchesTag,
} from "@/lib/communityDiscovery";
import { routes } from "@/lib/routes";
import { useArticleStore } from "@/stores/articleStore";
import { useCommunityStore } from "@/stores/communityStore";

export default function CommunityTagScreen() {
  const insets = useSafeAreaInsets();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const posts = useCommunityStore((state) => state.posts);
  const fetchPosts = useCommunityStore((state) => state.fetchPosts);
  const articles = useArticleStore((state) => state.articles);
  const fetchArticles = useArticleStore((state) => state.fetchArticles);

  useEffect(() => {
    if (posts.length === 0) {
      void fetchPosts();
    }
    if (articles.length === 0) {
      void fetchArticles();
    }
  }, [articles.length, fetchArticles, fetchPosts, posts.length]);

  const tagName = tag ?? "";
  // 标签页首期采用“内容命中 + 推导标签命中”的双保险策略，保证能看到内容。
  const matchedPosts = useMemo(
    () => posts.filter((post) => postMatchesTag(post, tagName)),
    [posts, tagName],
  );
  const matchedArticles = useMemo(
    () => articles.filter((article) => articleMatchesTag(article, tagName)),
    [articles, tagName],
  );

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
            <Text className="text-on-surface text-lg font-bold">#{tagName}</Text>
            <Text className="text-outline text-[11px]">
              内容 {matchedPosts.length} · 茶知识 {matchedArticles.length}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(routes.search)}
            className="w-10 h-10 items-center justify-center"
            hitSlop={8}
          >
            <MaterialIcons name="search" size={20} color={Colors.onSurface} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl bg-surface-container-low px-5 py-4 gap-2">
          <Text className="text-on-surface text-base font-bold">
            与 #{tagName} 相关的内容
          </Text>
          <Text className="text-on-surface-variant text-xs leading-5">
            这里先聚合社区帖子和茶知识内容，后续再接真实标签字段与更多筛选。
          </Text>
        </View>

        {matchedPosts.length > 0 ? (
          <View className="gap-4">
            <Text className="text-on-surface text-base font-bold">社区内容</Text>
            {matchedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </View>
        ) : null}

        {matchedArticles.length > 0 ? (
          <View className="gap-4">
            <Text className="text-on-surface text-base font-bold">茶知识</Text>
            {matchedArticles.map((article) => (
              <Pressable
                key={article.id}
                onPress={() => router.push(routes.article(article.id))}
                className="active:opacity-85"
              >
                <ArticleCard article={article} large />
              </Pressable>
            ))}
          </View>
        ) : null}

        {matchedPosts.length === 0 && matchedArticles.length === 0 ? (
          <View className="rounded-3xl bg-surface-container-low px-5 py-6 items-center gap-2">
            <MaterialIcons name="tag" size={26} color={Colors.outline} />
            <Text className="text-on-surface-variant text-sm text-center leading-6">
              暂时还没有和 #{tagName} 相关的内容，换个茶名或问题词试试。
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
