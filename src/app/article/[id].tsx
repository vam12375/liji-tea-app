import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, ScrollView, Pressable, Share } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { useArticleStore, type ContentBlock } from '@/stores/articleStore';

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const articles = useArticleStore((s) => s.articles);
  const article = articles.find((a) => a.id === id);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  /** 分享文章 */
  const handleShare = async () => {
    if (!article) return;
    try {
      await Share.share({ message: `【李记茶铺】${article.title}\n${article.subtitle ?? ''}` });
    } catch { /* 用户取消分享 */ }
  };

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
        {/* Hero 图片 */}
        <View style={{ height: 280 }} className="relative">
          <Image
            source={{ uri: article.image }}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            contentFit="cover"
            transition={300}
          />
          {/* 顶部渐变遮罩 */}
          <View className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />

          {/* 返回按钮 */}
          <Pressable
            onPress={() => router.back()}
            style={{ top: insets.top + 8 }}
            className="absolute left-4 w-10 h-10 bg-black/30 rounded-full items-center justify-center active:bg-black/50"
          >
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </Pressable>

          {/* 收藏按钮 */}
          <Pressable
            onPress={() => setIsBookmarked((v) => !v)}
            style={{ top: insets.top + 8 }}
            className="absolute right-4 w-10 h-10 bg-black/30 rounded-full items-center justify-center active:bg-black/50"
          >
            <MaterialIcons name={isBookmarked ? "bookmark" : "bookmark-border"} size={22} color={isBookmarked ? Colors.primary : "#fff"} />
          </Pressable>
        </View>

        {/* 文章头部信息 */}
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
          {article.subtitle && (
            <Text className="text-on-surface-variant text-base leading-relaxed">
              {article.subtitle}
            </Text>
          )}
        </View>

        {/* 分隔线 */}
        <View className="mx-6 h-px bg-outline-variant/20" />

        {/* 文章正文 */}
        <View className="px-6 py-6 gap-5">
          {article.content?.map((block, index) => (
            <ContentBlockView key={index} block={block} />
          ))}
        </View>

        {/* 文章底部 */}
        <View className="mx-6 mb-6 p-5 bg-surface-container-low rounded-2xl gap-3">
          <Text className="text-on-surface font-bold text-sm">喜欢这篇文章？</Text>
          <Text className="text-on-surface-variant text-xs">分享给更多茶友，传递茶文化的温度</Text>
          <View className="flex-row gap-3 mt-1">
            <Pressable
              onPress={() => setIsLiked((v) => !v)}
              className="flex-row items-center gap-1.5 bg-primary-container/20 px-4 py-2 rounded-full active:opacity-80"
            >
              <MaterialIcons name={isLiked ? "favorite" : "favorite-border"} size={16} color={isLiked ? Colors.error : Colors.primary} />
              <Text className="text-primary text-xs font-medium">{isLiked ? "已点赞" : "点赞"}</Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              className="flex-row items-center gap-1.5 bg-primary-container/20 px-4 py-2 rounded-full active:opacity-80"
            >
              <MaterialIcons name="share" size={16} color={Colors.primary} />
              <Text className="text-primary text-xs font-medium">分享</Text>
            </Pressable>
          </View>
        </View>

        {/* 底部安全区域 */}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

/** 渲染单个内容块 */
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
          <Image
            source={{ uri: block.image }}
            style={{ width: '100%', height: 200, borderRadius: 12 }}
            contentFit="cover"
            transition={200}
          />
          {block.caption && (
            <Text className="text-outline text-xs text-center px-2">
              {block.caption}
            </Text>
          )}
        </View>
      );
    default:
      return null;
  }
}
