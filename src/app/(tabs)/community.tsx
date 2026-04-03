import { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { type CultureCategory } from '@/data/articles';
import { useArticleStore } from '@/stores/articleStore';
import { useCommunityStore, type Post } from '@/stores/communityStore';
import CommunityTabs from '@/components/community/CommunityTabs';
import StoryRow from '@/components/community/StoryRow';
import PostCard from '@/components/community/PostCard';
import FeaturedArticle from '@/components/culture/FeaturedArticle';
import CategoryTabs from '@/components/culture/CategoryTabs';
import ArticleCard from '@/components/culture/ArticleCard';
import BrewingShortcut from '@/components/culture/BrewingShortcut';
import SeasonalPicks from '@/components/culture/SeasonalPicks';

type CommunityTab = '推荐' | '茶友' | '茶道' | '问答';

const COMMUNITY_TABS: readonly CommunityTab[] = ['推荐', '茶友', '茶道', '问答'];

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<CommunityTab>('推荐');
  const [category, setCategory] = useState<CultureCategory>('全部');
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

  const filteredArticles = useMemo(
    () => (category === '全部' ? articles : articles.filter((article) => article.category === category)),
    [articles, category]
  );
  const featuredArticle = filteredArticles[0] ?? articles[0];
  const questionPosts = useMemo(() => posts.filter((post) => post.type === 'question'), [posts]);
  const brewingPosts = useMemo(() => posts.filter((post) => post.type === 'brewing'), [posts]);
  const hotPosts = useMemo(
    () => [...posts].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 3),
    [posts]
  );

  const openCreate = (type?: Post['type']) => {
    router.push(
      type
        ? { pathname: "/community/create", params: { type } }
        : "/community/create",
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingTop: insets.top }} className="px-6 pb-3 bg-background/70">
        <View className="flex-row justify-between items-center min-h-14">
          <View className="gap-1">
            <Text className="font-headline text-2xl text-on-surface font-bold">社区</Text>
            <Text className="text-on-surface-variant text-xs">茶道灵感 · 茶友分享 · 热门问答</Text>
          </View>
          <Pressable hitSlop={8} onPress={() => openCreate()}>
            <MaterialIcons name="edit-note" size={24} color={Colors.onSurface} />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 gap-6" showsVerticalScrollIndicator={false}>
        <CommunityTabs selected={tab} onSelect={(next) => setTab(next as CommunityTab)} tabs={COMMUNITY_TABS} />

        <View className="bg-surface-container-low rounded-3xl p-5 gap-4 border border-outline-variant/15">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="font-headline text-lg text-on-surface font-bold">把内容和茶友放到一个社区里</Text>
              <Text className="text-on-surface-variant text-xs leading-5">
                一边看茶道精选，一边发动态、晒冲泡、提问题，内容和互动不再割裂。
              </Text>
            </View>
            <View className="w-11 h-11 rounded-2xl bg-primary-container/15 items-center justify-center">
              <MaterialIcons name="forum" size={22} color={Colors.primary} />
            </View>
          </View>
          <View className="flex-row gap-3">
            <MetricPill icon="groups" label="茶友动态" value={`${posts.length}`} />
            <MetricPill icon="menu-book" label="茶道精选" value={`${articles.length}`} />
            <MetricPill icon="auto-awesome" label="圈内速览" value={`${stories.length}`} />
          </View>
        </View>

        {tab === '推荐' && (
          <View className="gap-6">
            <StoryRow />
            <CreatePrompt
              title="今天喝了什么？"
              description="晒茶席、发冲泡、提问题，社区会自动把你的内容推到最新动态里。"
              actionLabel="立即发布"
              onPress={() => openCreate('photo')}
            />

            <View className="gap-4">
              <SectionHeader title="茶友热议" actionLabel="去发帖" onPress={() => openCreate('photo')} />
              {hotPosts.length > 0 ? hotPosts.map((post) => <PostCard key={post.id} post={post} />) : <EmptyState text="社区还没有内容，发出第一条动态吧。" />}
            </View>

            {featuredArticle ? (
              <View className="gap-4">
                <SectionHeader title="茶道精选" actionLabel="查看更多" onPress={() => setTab('茶道')} />
                <FeaturedArticle article={featuredArticle} />
                {filteredArticles[1] ? <ArticleCard article={filteredArticles[1]} large /> : null}
              </View>
            ) : (
              <EmptyState text="还没有上架茶道内容。" />
            )}

            <SeasonalPicks />
          </View>
        )}

        {tab === '茶友' && (
          <View className="gap-6">
            <StoryRow />
            <CreatePrompt
              title="发一条茶友动态"
              description="支持晒图、记录冲泡心得，或者直接向圈子里提问。"
              actionLabel="写动态"
              onPress={() => openCreate('photo')}
            />
            {posts.length > 0 ? posts.map((post) => <PostCard key={post.id} post={post} />) : <EmptyState text="还没有动态，快来发布第一条吧。" />}
          </View>
        )}

        {tab === '茶道' && (
          <View className="gap-6">
            <CategoryTabs selected={category} onSelect={setCategory} />
            {featuredArticle ? (
              <>
                <FeaturedArticle article={featuredArticle} />
                {filteredArticles[1] ? <ArticleCard article={filteredArticles[1]} large /> : null}
                <BrewingShortcut onPress={() => setCategory('冲泡')} />
                {filteredArticles.length > 2 ? (
                  <View className="flex-row gap-4">
                    {filteredArticles.slice(2, 4).map((article) => (
                      <ArticleCard key={article.id} article={article} />
                    ))}
                  </View>
                ) : null}
                <SeasonalPicks />
              </>
            ) : (
              <EmptyState text="茶道内容正在整理中，稍后再来看看。" />
            )}

            {brewingPosts.length > 0 ? (
              <View className="gap-4">
                <SectionHeader title="茶友冲泡实拍" actionLabel="看更多" onPress={() => setTab('茶友')} />
                {brewingPosts.slice(0, 2).map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </View>
            ) : null}
          </View>
        )}

        {tab === '问答' && (
          <View className="gap-6">
            <CreatePrompt
              title="有问题，直接问茶友"
              description="从选茶、器具到冲泡细节，问题发出来后会出现在问答区。"
              actionLabel="我要提问"
              onPress={() => openCreate('question')}
            />
            {questionPosts.length > 0 ? questionPosts.map((post) => <PostCard key={post.id} post={post} />) : <EmptyState text="暂无问答，欢迎抛出你的第一个问题。" />}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => openCreate()}
        className="absolute bottom-24 right-6 h-14 px-5 bg-primary rounded-full flex-row items-center gap-2 active:scale-95"
        style={{ elevation: 8 }}
      >
        <MaterialIcons name="add" size={22} color="#fff" />
        <Text className="text-white text-sm font-medium">发帖</Text>
      </Pressable>
    </View>
  );
}

function SectionHeader({ title, actionLabel, onPress }: { title: string; actionLabel?: string; onPress?: () => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-headline text-lg text-on-surface font-bold">{title}</Text>
      {actionLabel && onPress ? (
        <Pressable onPress={onPress} hitSlop={8}>
          <Text className="text-primary text-xs font-medium">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MetricPill({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
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
          <Text className="text-on-surface-variant text-xs leading-5">{description}</Text>
        </View>
        <View className="w-10 h-10 rounded-2xl bg-white/70 items-center justify-center">
          <MaterialIcons name="rate-review" size={20} color={Colors.secondary} />
        </View>
      </View>
      <Pressable onPress={onPress} className="self-start bg-primary px-4 py-2 rounded-full active:opacity-85">
        <Text className="text-white text-xs font-medium">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="rounded-3xl bg-surface-container-low px-5 py-6 items-center gap-2 border border-outline-variant/10">
      <MaterialIcons name="forum" size={26} color={Colors.outline} />
      <Text className="text-on-surface-variant text-sm text-center leading-6">{text}</Text>
    </View>
  );
}
