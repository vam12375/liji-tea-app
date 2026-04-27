import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import CommunityTabs from "@/components/community/CommunityTabs";
import PostCard from "@/components/community/PostCard";
import StoryRow from "@/components/community/StoryRow";
import ArticleCard from "@/components/culture/ArticleCard";
import FeaturedArticle from "@/components/culture/FeaturedArticle";
import SeasonalPicks from "@/components/culture/SeasonalPicks";
import { Colors } from "@/constants/Colors";
import { routes } from "@/lib/routes";
import { useArticleStore } from "@/stores/articleStore";
import { useCommunityStore, type Post } from "@/stores/communityStore";

type CommunityTab = "推荐" | "问答" | "冲泡";

const COMMUNITY_TABS: readonly CommunityTab[] = ["推荐", "问答", "冲泡"];
const RECOMMENDED_TOPICS = ["春茶", "龙井", "入门喝什么", "办公室泡法"] as const;

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<CommunityTab>("推荐");
  const articles = useArticleStore((state) => state.articles);
  const fetchArticles = useArticleStore((state) => state.fetchArticles);
  const posts = useCommunityStore((state) => state.posts);
  const stories = useCommunityStore((state) => state.stories);
  const fetchPosts = useCommunityStore((state) => state.fetchPosts);
  const fetchStories = useCommunityStore((state) => state.fetchStories);

  useEffect(() => {
    void fetchArticles();
    void fetchPosts();
    void fetchStories();
  }, [fetchArticles, fetchPosts, fetchStories]);

  const questionPosts = useMemo(
    () => posts.filter((post) => post.type === "question"),
    [posts],
  );
  const brewingPosts = useMemo(
    () => posts.filter((post) => post.type === "brewing"),
    [posts],
  );
  const photoPosts = useMemo(
    () => posts.filter((post) => post.type === "photo"),
    [posts],
  );

  // 推荐页先用轻量规则混排图文、问答和冲泡，避免过早引入复杂推荐体系。
  const recommendedPosts = useMemo(() => {
    const trending = [...posts]
      .sort((left, right) => {
        const leftScore = left.likes * 2 + left.comments;
        const rightScore = right.likes * 2 + right.comments;
        return rightScore - leftScore;
      })
      .slice(0, 2);

    return [
      ...trending,
      ...questionPosts.slice(0, 2),
      ...brewingPosts.slice(0, 2),
      ...photoPosts.slice(0, 2),
    ].filter(
      (post, index, list) =>
        list.findIndex((candidate) => candidate.id === post.id) === index,
    );
  }, [brewingPosts, photoPosts, posts, questionPosts]);

  const featuredArticle = articles[0];
  const secondaryArticle = articles[1];

  const openCreate = (type?: Post["type"]) => {
    router.push(routes.communityCreate(type));
  };

  return (
    <View className="flex-1 bg-background">
      <View
        style={{ paddingTop: insets.top }}
        className="px-6 pb-3 bg-background/70"
      >
        <View className="flex-row justify-between items-center min-h-14">
          <View className="gap-1">
            <Text className="font-headline text-2xl text-on-surface font-bold">
              社区
            </Text>
            <Text className="text-on-surface-variant text-xs">
              今天喝什么 · 怎么泡 · 值不值得买
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <HeaderAction
              icon="search"
              label="搜索"
              onPress={() => router.push(routes.search)}
            />
            <HeaderAction
              icon="bookmark-border"
              label="社区收藏"
              onPress={() => router.push(routes.communitySaved)}
            />
            <HeaderAction
              icon="article"
              label="我的帖子"
              onPress={() => router.push(routes.myPosts)}
            />
            <HeaderAction
              icon="edit-note"
              label="发帖"
              onPress={() => openCreate()}
            />
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 gap-6"
        showsVerticalScrollIndicator={false}
      >
        <CommunityTabs
          selected={tab}
          onSelect={(next) => setTab(next as CommunityTab)}
          tabs={COMMUNITY_TABS}
        />

        <HeroCard
          postsCount={posts.length}
          articlesCount={articles.length}
          storiesCount={stories.length}
        />

        {tab === "推荐" ? (
          <View className="gap-6">
            <StoryRow />

            <CreatePrompt
              title="今天喝了什么？"
              description="晒茶席、记冲泡、提问题，让内容不只被看到，还能帮别人做决定。"
              actionLabel="马上发布"
              onPress={() => openCreate("photo")}
            />

            <TopicRail />

            <View className="gap-4">
              <SectionHeader
                title="社区热聊"
                actionLabel="去提问"
                onPress={() => setTab("问答")}
              />
              {recommendedPosts.length > 0 ? (
                recommendedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))
              ) : (
                <EmptyState text="社区还没有内容，发出第一条动态吧。" />
              )}
            </View>

            {featuredArticle ? (
              <View className="gap-4">
                <SectionHeader
                  title="茶知识精选"
                  actionLabel="看更多"
                  onPress={() => router.push(routes.article(featuredArticle.id))}
                />
                <FeaturedArticle article={featuredArticle} />
                {secondaryArticle ? (
                  <ArticleCard article={secondaryArticle} large />
                ) : null}
              </View>
            ) : null}

            <SeasonalPicks />
          </View>
        ) : null}

        {tab === "问答" ? (
          <View className="gap-6">
            <CreatePrompt
              title="把问题直接抛给茶友"
              description="从选茶、器具到冲泡细节，先问清楚，再决定要不要买。"
              actionLabel="我要提问"
              onPress={() => openCreate("question")}
            />

            <View className="gap-4">
              <SectionHeader title="最新问题" />
              {questionPosts.length > 0 ? (
                questionPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))
              ) : (
                <EmptyState text="暂无问答，欢迎抛出你的第一个问题。" />
              )}
            </View>
          </View>
        ) : null}

        {tab === "冲泡" ? (
          <View className="gap-6">
            <CreatePrompt
              title="记录一次冲泡"
              description="把水温、时间和感受记下来，让同类茶友少走弯路。"
              actionLabel="写冲泡记录"
              onPress={() => openCreate("brewing")}
            />

            <View className="gap-4">
              <SectionHeader title="最新冲泡记录" />
              {brewingPosts.length > 0 ? (
                brewingPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))
              ) : (
                <EmptyState text="还没有冲泡记录，记录一杯你的今日茶汤吧。" />
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => openCreate()}
        className="absolute bottom-24 right-6 h-14 px-5 bg-primary rounded-full flex-row items-center gap-2"
        style={({ pressed }) => [
          { elevation: 8, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
      >
        <MaterialIcons name="add" size={22} color="#fff" />
        <Text className="text-white text-sm font-medium">发帖</Text>
      </Pressable>
    </View>
  );
}

function HeaderAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      hitSlop={8}
      onPress={onPress}
      className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center"
      accessibilityLabel={label}
    >
      <MaterialIcons name={icon} size={20} color={Colors.onSurface} />
    </Pressable>
  );
}

function HeroCard({
  postsCount,
  articlesCount,
  storiesCount,
}: {
  postsCount: number;
  articlesCount: number;
  storiesCount: number;
}) {
  return (
    <View className="bg-surface-container-low rounded-3xl p-5 gap-4 border border-outline-variant/15">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text className="font-headline text-lg text-on-surface font-bold">
            从看内容走到买茶决策
          </Text>
          <Text className="text-on-surface-variant text-xs leading-5">
            在推荐里找灵感，在问答里把问题问清楚，在冲泡里看真实经验。
          </Text>
        </View>
        <View className="w-11 h-11 rounded-2xl bg-primary-container/15 items-center justify-center">
          <MaterialIcons name="forum" size={22} color={Colors.primary} />
        </View>
      </View>

      <View className="flex-row gap-3">
        <MetricPill icon="forum" label="内容动态" value={`${postsCount}`} />
        <MetricPill
          icon="menu-book"
          label="官方内容"
          value={`${articlesCount}`}
        />
        <MetricPill
          icon="auto-awesome"
          label="故事速览"
          value={`${storiesCount}`}
        />
      </View>
    </View>
  );
}

function TopicRail() {
  return (
    <View className="gap-3">
      <SectionHeader title="最近大家在聊" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-1"
      >
        {RECOMMENDED_TOPICS.map((topic) => (
          <Pressable
            key={topic}
            // 话题首期直接落标签页，后续再替换成真实标签模型。
            onPress={() => router.push(routes.communityTag(topic))}
            className="px-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/10"
          >
            <Text className="text-on-surface text-xs font-medium">
              #{topic}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-headline text-lg text-on-surface font-bold">
        {title}
      </Text>
      {actionLabel && onPress ? (
        <Pressable onPress={onPress} hitSlop={8}>
          <Text className="text-primary text-xs font-medium">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MetricPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 rounded-2xl bg-background px-3 py-3 gap-1 border border-outline-variant/10">
      <MaterialIcons name={icon} size={18} color={Colors.primary} />
      <Text className="text-on-surface text-sm font-bold">{value}</Text>
      <Text className="text-on-surface-variant text-[11px]">{label}</Text>
    </View>
  );
}

function CreatePrompt({
  title,
  description,
  actionLabel,
  onPress,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View className="rounded-3xl bg-secondary-container/25 px-5 py-4 gap-3 border border-secondary/10">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text className="text-on-surface text-base font-bold">{title}</Text>
          <Text className="text-on-surface-variant text-xs leading-5">
            {description}
          </Text>
        </View>
        <View className="w-10 h-10 rounded-2xl bg-white/70 items-center justify-center">
          <MaterialIcons
            name="rate-review"
            size={20}
            color={Colors.secondary}
          />
        </View>
      </View>
      <Pressable
        onPress={onPress}
        className="self-start bg-primary px-4 py-2 rounded-full active:opacity-85"
      >
        <Text className="text-white text-xs font-medium">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="rounded-3xl bg-surface-container-low px-5 py-6 items-center gap-2 border border-outline-variant/10">
      <MaterialIcons name="forum" size={26} color={Colors.outline} />
      <Text className="text-on-surface-variant text-sm text-center leading-6">
        {text}
      </Text>
    </View>
  );
}
