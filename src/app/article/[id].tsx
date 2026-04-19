import { useEffect, useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { TeaImage } from "@/components/ui/TeaImage";

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { track } from '@/lib/analytics';
import { shareContent } from '@/lib/share';
import { useArticleStore, type ContentBlock } from '@/stores/articleStore';
import { useUserStore } from '@/stores/userStore';
import { showModal } from '@/stores/modalStore';


export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const articles = useArticleStore((state) => state.articles);
  const loading = useArticleStore((state) => state.loading);
  const likedArticleIds = useArticleStore((state) => state.likedArticleIds);
  const bookmarkedArticleIds = useArticleStore((state) => state.bookmarkedArticleIds);
  const fetchArticles = useArticleStore((state) => state.fetchArticles);
  const toggleArticleLike = useArticleStore((state) => state.toggleArticleLike);
  const toggleArticleBookmark = useArticleStore((state) => state.toggleArticleBookmark);
  const session = useUserStore((state) => state.session);
  const article = useMemo(() => articles.find((item) => item.id === id), [articles, id]);
  const isBookmarked = article ? bookmarkedArticleIds.has(article.id) : false;
  const isLiked = article ? likedArticleIds.has(article.id) : false;

  useEffect(() => {
    if (!id) return;
    void fetchArticles();
  }, [fetchArticles, id, session?.user?.id]);

  // 文章阅读埋点：切换 id 时触发，作为内容侧活跃度基线。
  useEffect(() => {
    if (!id) return;
    track('article_view', { articleId: id });
  }, [id]);

  const requireLogin = () => {
    if (session?.user?.id) return true;
    showModal('请先登录', '登录后才可以点赞或收藏文章。', 'info');
    router.push('/login');
    return false;
  };

  const handleToggleLike = async () => {
    if (!article || !requireLogin()) return;

    try {
      await toggleArticleLike(article.id);
    } catch (error: any) {
      showModal('操作失败', error?.message ?? '请稍后重试。', 'error');
    }
  };

  const handleToggleBookmark = async () => {
    if (!article || !requireLogin()) return;

    try {
      await toggleArticleBookmark(article.id);
    } catch (error: any) {
      showModal('收藏失败', error?.message ?? '请稍后重试。', 'error');
    }
  };

  const handleShare = async () => {
    if (!article) return;

    try {
      await shareContent({
        path: `/article/${encodeURIComponent(article.id)}`,
        title: article.title,
        lines: [`【李记茶铺】${article.title}`, article.subtitle],
      });
    } catch {
      // 用户取消分享
    }
  };




  if (!article && loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3">
        <MaterialIcons name="hourglass-top" size={26} color={Colors.outline} />
        <Text className="text-on-surface-variant text-base">正在加载文章...</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-on-surface-variant text-base">文章未找到</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-2 bg-primary rounded-full">
          <Text className="text-on-primary text-sm">返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View style={{ height: 280 }} className="relative">
          <TeaImage
            source={{ uri: article.image }}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            contentFit="cover"
            transition={300}
          />
          <View className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />

          <Pressable
            onPress={() => router.back()}
            style={{ top: insets.top + 8 }}
            className="absolute left-4 w-10 h-10 bg-black/30 rounded-full items-center justify-center active:bg-black/50"
          >
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </Pressable>

          <Pressable
            onPress={handleToggleBookmark}
            style={{ top: insets.top + 8 }}
            className="absolute right-4 w-10 h-10 bg-black/30 rounded-full items-center justify-center active:bg-black/50"
          >
            <MaterialIcons name={isBookmarked ? 'bookmark' : 'bookmark-border'} size={22} color={isBookmarked ? Colors.primary : '#fff'} />
          </Pressable>
        </View>

        <View className="px-6 pt-6 pb-4 gap-3">
          <View className="flex-row items-center gap-3">
            <View className="bg-tertiary px-3 py-1 rounded-full">
              <Text className="text-on-tertiary text-xs font-bold">{article.category}</Text>
            </View>
            <Text className="text-outline text-xs">{article.date}</Text>
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="schedule" size={12} color={Colors.outline} />
              <Text className="text-outline text-xs">{article.readTime}</Text>
            </View>
          </View>
          <Text className="font-headline text-2xl text-on-surface font-bold leading-tight">
            {article.title}
          </Text>
          {article.subtitle ? (
            <Text className="text-on-surface-variant text-base leading-relaxed">
              {article.subtitle}
            </Text>
          ) : null}
        </View>

        <View className="mx-6 h-px bg-outline-variant/20" />

        <View className="px-6 py-6 gap-5">
          {article.content?.map((block, index) => (
            <ContentBlockView key={index} block={block} />
          ))}
        </View>

        <View className="mx-6 mb-6 p-5 bg-surface-container-low rounded-2xl gap-3">
          <Text className="text-on-surface font-bold text-sm">喜欢这篇文章？</Text>
          <Text className="text-on-surface-variant text-xs">分享给更多茶友，或直接去社区继续聊茶</Text>
          <View className="flex-row gap-3 mt-1 flex-wrap">
            <Pressable
              onPress={handleToggleLike}
              className="flex-row items-center gap-1.5 bg-primary-container/20 px-4 py-2 rounded-full active:opacity-80"
            >
              <MaterialIcons name={isLiked ? 'favorite' : 'favorite-border'} size={16} color={isLiked ? Colors.error : Colors.primary} />
              <Text className="text-primary text-xs font-medium">{isLiked ? '已点赞' : '点赞'}</Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              className="flex-row items-center gap-1.5 bg-primary-container/20 px-4 py-2 rounded-full active:opacity-80"
            >
              <MaterialIcons name="share" size={16} color={Colors.primary} />
              <Text className="text-primary text-xs font-medium">分享</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/community')}
              className="flex-row items-center gap-1.5 bg-primary px-4 py-2 rounded-full active:opacity-80"
            >
              <MaterialIcons name="forum" size={16} color="#fff" />
              <Text className="text-white text-xs font-medium">去社区聊聊</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <Text className="font-headline text-lg text-on-surface font-bold mt-2">
          {block.text}
        </Text>
      );
    case 'paragraph':
      return (
        <Text className="text-on-surface/90 text-[15px] leading-7">
          {block.text}
        </Text>
      );
    case 'image':
      return (
        <View className="gap-2 my-1">
          <TeaImage
            source={{ uri: block.image }}
            style={{ width: '100%', height: 200, borderRadius: 12 }}
            contentFit="cover"
            transition={200}
          />
          {block.caption ? (
            <Text className="text-outline text-xs text-center px-2">
              {block.caption}
            </Text>
          ) : null}
        </View>
      );
    default:
      return null;
  }
}
