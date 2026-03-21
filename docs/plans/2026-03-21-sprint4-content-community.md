# Sprint 4: 内容 + 社区 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现茶文化内容页（文章列表+分类）、搜索页面（历史+热搜+推荐）、社区动态页（故事+帖子流+FAB）。

**Architecture:** 茶文化和社区使用模拟数据驱动。搜索页为独立路由 `/search`。社区帖子支持三种类型（图文/冲泡分享/求助）。所有页面复用设计 Token 体系。

**Tech Stack:** 基于 Sprint 3，无新增依赖

---

## Task 1: 茶文化数据 + 茶道 Tab 页面

**Files:**
- Create: `src/data/articles.ts`
- Create: `src/components/culture/FeaturedArticle.tsx`
- Create: `src/components/culture/CategoryTabs.tsx`
- Create: `src/components/culture/ArticleCard.tsx`
- Create: `src/components/culture/BrewingShortcut.tsx`
- Create: `src/components/culture/SeasonalPicks.tsx`
- Modify: `src/app/(tabs)/culture.tsx`

**Step 1: 创建文章数据**

创建 `src/data/articles.ts`：

```typescript
export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  image: string;
  readTime: string;
  date: string;
}

export const CULTURE_CATEGORIES = ["全部", "茶史", "冲泡", "茶器", "茶人", "节气茶", "产地"] as const;
export type CultureCategory = (typeof CULTURE_CATEGORIES)[number];

export const articles: Article[] = [
  {
    id: "a1",
    title: "宋代点茶：一碗沫浆的千年风雅",
    subtitle: "从建盏到茶筅，探索宋人的极致美学",
    category: "茶史",
    image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=800",
    readTime: "8分钟",
    date: "2024.03.15",
  },
  {
    id: "a2",
    title: "高山云雾：探访大红袍的起源之地",
    subtitle: "武夷山的丹霞地貌如何造就岩茶传奇",
    category: "产地",
    image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800",
    readTime: "5分钟",
    date: "2024.03.12",
  },
  {
    id: "a3",
    title: "紫砂壶的呼吸：如何挑选第一把好壶",
    subtitle: "从泥料到工艺，新手选壶指南",
    category: "茶器",
    image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800",
    readTime: "6分钟",
    date: "2024.03.10",
  },
  {
    id: "a4",
    title: "春水煎茶：明前龙井的鲜甜奥秘",
    subtitle: "清明前后，一杯绿茶的时令之美",
    category: "冲泡",
    image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800",
    readTime: "4分钟",
    date: "2024.03.08",
  },
  {
    id: "a5",
    title: "陆羽传：茶圣的一生与《茶经》",
    subtitle: "中国茶文化的开山之作背后的故事",
    category: "茶人",
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800",
    readTime: "10分钟",
    date: "2024.03.05",
  },
  {
    id: "a6",
    title: "春分宜饮：时令养生茶推荐",
    subtitle: "顺应节气，品味自然之道",
    category: "节气茶",
    image: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=800",
    readTime: "3分钟",
    date: "2024.03.20",
  },
];

export const seasonalPicks = [
  { name: "安吉白茶", desc: "清新鲜爽，春分首选", image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=200" },
  { name: "洞庭碧螺春", desc: "花果香馥，时令佳品", image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=200" },
];
```

**Step 2: 创建各组件**

创建 `src/components/culture/FeaturedArticle.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import type { Article } from "@/data/articles";

export default function FeaturedArticle({ article }: { article: Article }) {
  return (
    <Pressable className="h-[220px] rounded-2xl overflow-hidden active:opacity-90">
      <Image source={{ uri: article.image }} className="absolute inset-0 w-full h-full" contentFit="cover" />
      <View className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <View className="absolute top-4 left-4">
        <View className="bg-tertiary px-2.5 py-0.5 rounded-full">
          <Text className="text-on-tertiary text-[10px] font-bold">{article.category}</Text>
        </View>
      </View>
      <View className="absolute bottom-6 left-6 right-6 gap-1">
        <Text className="font-headline text-xl text-surface-bright font-bold">{article.title}</Text>
        <Text className="text-surface-bright/60 text-xs">{article.date}</Text>
      </View>
    </Pressable>
  );
}
```

创建 `src/components/culture/CategoryTabs.tsx`：

```typescript
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
```

创建 `src/components/culture/ArticleCard.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { Article } from "@/data/articles";

export default function ArticleCard({ article, large = false }: { article: Article; large?: boolean }) {
  return (
    <Pressable className={`${large ? "" : "flex-1"} active:opacity-80`}>
      <View className={`${large ? "aspect-video" : "aspect-square"} rounded-xl overflow-hidden mb-2`}>
        <Image source={{ uri: article.image }} className="w-full h-full" contentFit="cover" transition={200} />
      </View>
      <Text className={`font-headline text-on-surface ${large ? "text-xl" : "text-sm"} font-bold`} numberOfLines={2}>
        {article.title}
      </Text>
      {article.subtitle && (
        <Text className="text-on-surface-variant text-xs mt-1" numberOfLines={2}>{article.subtitle}</Text>
      )}
      {large && (
        <View className="flex-row items-center gap-1 mt-2">
          <MaterialIcons name="schedule" size={12} color={Colors.outline} />
          <Text className="text-outline text-xs">{article.readTime}阅读</Text>
        </View>
      )}
    </Pressable>
  );
}
```

创建 `src/components/culture/BrewingShortcut.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

export default function BrewingShortcut() {
  return (
    <Pressable className="bg-primary-container/10 border border-primary/5 rounded-2xl p-5 flex-row items-center justify-between active:opacity-80">
      <View className="flex-1 gap-1">
        <Text className="font-headline text-on-surface text-base font-bold">冲泡指南</Text>
        <Text className="text-on-surface-variant text-xs">掌握每一款茶的最佳冲泡方式</Text>
      </View>
      <View className="w-12 h-12 bg-primary-container/20 rounded-full items-center justify-center">
        <MaterialIcons name="coffee-maker" size={28} color={Colors.primaryContainer} />
      </View>
    </Pressable>
  );
}
```

创建 `src/components/culture/SeasonalPicks.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { seasonalPicks } from "@/data/articles";

export default function SeasonalPicks() {
  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-2">
        <View className="w-7 h-7 rounded-full bg-tertiary-fixed items-center justify-center">
          <MaterialIcons name="eco" size={16} color={Colors.tertiary} />
        </View>
        <View>
          <Text className="font-headline text-on-surface text-base font-bold">节气 · 春分</Text>
          <Text className="text-on-surface-variant text-[10px]">春分宜饮</Text>
        </View>
      </View>
      <View className="gap-3">
        {seasonalPicks.map((pick) => (
          <Pressable key={pick.name} className="flex-row items-center gap-3 active:opacity-80">
            <Image source={{ uri: pick.image }} className="w-16 h-16 rounded-xl" contentFit="cover" />
            <View className="flex-1 gap-0.5">
              <Text className="text-on-surface text-sm font-bold">{pick.name}</Text>
              <Text className="text-on-surface-variant text-xs">{pick.desc}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

**Step 3: 组装茶道页面**

修改 `src/app/(tabs)/culture.tsx`：

```typescript
import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { articles, type CultureCategory } from "@/data/articles";
import FeaturedArticle from "@/components/culture/FeaturedArticle";
import CategoryTabs from "@/components/culture/CategoryTabs";
import ArticleCard from "@/components/culture/ArticleCard";
import BrewingShortcut from "@/components/culture/BrewingShortcut";
import SeasonalPicks from "@/components/culture/SeasonalPicks";

export default function CultureScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<CultureCategory>("全部");

  const filtered = useMemo(
    () => category === "全部" ? articles : articles.filter((a) => a.category === category),
    [category]
  );

  return (
    <View className="flex-1 bg-background">
      {/* 顶部标题栏 */}
      <View style={{ paddingTop: insets.top }} className="px-6 pb-3 bg-background/70">
        <View className="flex-row justify-between items-center h-14">
          <Text className="font-headline text-2xl text-on-surface font-bold">茶道</Text>
          <View className="flex-row gap-4">
            <Pressable hitSlop={8}>
              <MaterialIcons name="bookmark-border" size={24} color={Colors.onSurface} />
            </Pressable>
            <Pressable hitSlop={8}>
              <MaterialIcons name="search" size={24} color={Colors.onSurface} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 gap-8" showsVerticalScrollIndicator={false}>
        {filtered.length > 0 && <FeaturedArticle article={filtered[0]} />}
        <CategoryTabs selected={category} onSelect={setCategory} />
        {filtered.length > 1 && <ArticleCard article={filtered[1]} large />}
        <BrewingShortcut />
        {filtered.length > 2 && (
          <View className="flex-row gap-4">
            {filtered.slice(2, 4).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </View>
        )}
        <SeasonalPicks />
      </ScrollView>
    </View>
  );
}
```

**Step 4: 提交**

```bash
git add src/data/articles.ts src/components/culture/ src/app/(tabs)/culture.tsx
git commit -m "feat: 茶道内容页（精选文章/分类/冲泡指南/节气推荐）"
```

---

## Task 2: 搜索页面

**Files:**
- Create: `src/data/search.ts`
- Create: `src/app/search.tsx`
- Create: `src/components/search/SearchHistoryChips.tsx`
- Create: `src/components/search/HotSearches.tsx`

**Step 1: 创建搜索数据**

创建 `src/data/search.ts`：

```typescript
export const defaultSearchHistory = ["龙井", "白毫银针", "冲泡方法", "送礼推荐"];

export const hotSearches = [
  "明前龙井", "春茶上新", "岩茶推荐", "普洱老生茶",
  "大红袍", "盖碗套装", "白茶饼", "紫砂壶开壶",
];

export const suggestedProducts = [
  { id: "s1", name: "狮峰龙井 · 明前特级", desc: "2024新茶", price: 1280, image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400" },
  { id: "s2", name: "政和白牡丹 · 七年陈", desc: "陈化佳品", price: 658, image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400" },
  { id: "s3", name: "武夷大红袍 · 传统足火", desc: "岩骨花香", price: 899, image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=400" },
  { id: "s4", name: "月白汝窑 · 快客杯", desc: "随行茶器", price: 238, image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400" },
];
```

**Step 2: 创建搜索历史标签**

创建 `src/components/search/SearchHistoryChips.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

interface Props {
  items: string[];
  onClear: () => void;
  onSelect: (term: string) => void;
}

export default function SearchHistoryChips({ items, onClear, onSelect }: Props) {
  if (items.length === 0) return null;
  return (
    <View className="gap-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-on-surface font-medium text-sm">搜索历史</Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <MaterialIcons name="delete-outline" size={18} color={Colors.outline} />
        </Pressable>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <Pressable key={item} onPress={() => onSelect(item)} className="bg-surface-container-low px-4 py-1.5 rounded-full">
            <Text className="text-on-surface-variant text-sm">{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

**Step 3: 创建热搜列表**

创建 `src/components/search/HotSearches.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

interface Props {
  items: string[];
  onSelect: (term: string) => void;
}

export default function HotSearches({ items, onSelect }: Props) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-1">
        <MaterialIcons name="trending-up" size={18} color={Colors.tertiary} />
        <Text className="text-on-surface font-medium text-sm">热门搜索</Text>
      </View>
      <View className="flex-row flex-wrap gap-y-4 gap-x-6">
        {items.map((item, i) => (
          <Pressable key={item} onPress={() => onSelect(item)} className="flex-row items-center gap-2 w-[45%]">
            {i < 3 ? (
              <View className="w-5 h-5 rounded-full bg-tertiary-fixed items-center justify-center">
                <Text className="text-on-surface text-[10px] font-bold">{i + 1}</Text>
              </View>
            ) : (
              <Text className="text-on-surface-variant/40 text-xs w-5 text-center">{i + 1}</Text>
            )}
            <Text className="text-on-surface text-sm">{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

**Step 4: 创建搜索页面**

创建 `src/app/search.tsx`：

```typescript
import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { defaultSearchHistory, hotSearches, suggestedProducts } from "@/data/search";
import SearchHistoryChips from "@/components/search/SearchHistoryChips";
import HotSearches from "@/components/search/HotSearches";

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState(defaultSearchHistory);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 搜索栏 */}
      <View className="px-4 pt-2 pb-3 flex-row items-center gap-3">
        <View className="flex-1 flex-row items-center bg-surface-container-high rounded-full px-4 h-11 gap-2">
          <MaterialIcons name="search" size={20} color={Colors.outline} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索茶品、茶器、冲泡方法..."
            placeholderTextColor={Colors.outline}
            className="flex-1 text-on-surface text-sm"
            autoFocus
            returnKeyType="search"
          />
          <Pressable hitSlop={8}>
            <MaterialIcons name="photo-camera" size={20} color={Colors.outline} />
          </Pressable>
        </View>
        <Pressable onPress={() => router.back()}>
          <Text className="text-primary text-sm">取消</Text>
        </Pressable>
      </View>

      {/* 内容 */}
      <FlatList
        data={suggestedProducts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperClassName="gap-3 px-4"
        contentContainerClassName="px-4 gap-8 pb-8"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-8">
            <SearchHistoryChips items={history} onClear={() => setHistory([])} onSelect={setQuery} />
            <HotSearches items={hotSearches} onSelect={setQuery} />
            <Text className="text-on-surface font-medium text-sm">猜你喜欢</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable className="flex-1 active:opacity-80">
            <View className="aspect-[4/5] rounded-xl overflow-hidden mb-2">
              <Image source={{ uri: item.image }} className="w-full h-full" contentFit="cover" transition={200} />
            </View>
            <Text className="font-headline text-on-surface text-sm font-bold" numberOfLines={1}>{item.name}</Text>
            <Text className="text-on-surface-variant text-xs">{item.desc}</Text>
            <Text className="text-tertiary font-bold mt-1">¥{item.price}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
```

**Step 5: 提交**

```bash
git add src/data/search.ts src/components/search/ src/app/search.tsx
git commit -m "feat: 搜索页面（历史标签/热搜排行/猜你喜欢）"
```

---

## Task 3: 社区动态页面

**Files:**
- Create: `src/data/community.ts`
- Create: `src/components/community/StoryRow.tsx`
- Create: `src/components/community/PostCard.tsx`
- Create: `src/components/community/CommunityTabs.tsx`
- Modify: `src/app/(tabs)/community.tsx`

**Step 1: 创建社区数据**

创建 `src/data/community.ts`：

```typescript
export interface Story {
  id: string;
  name: string;
  avatar: string;
  isViewed: boolean;
}

export interface Post {
  id: string;
  type: "photo" | "brewing" | "question";
  author: string;
  avatar: string;
  time: string;
  location?: string;
  // 图文帖
  image?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  // 冲泡分享
  teaName?: string;
  brewingData?: { temp: string; time: string; amount: string };
  brewingImages?: string[];
  quote?: string;
  // 求助帖
  title?: string;
  description?: string;
  answerCount?: number;
}

export const stories: Story[] = [
  { id: "s1", name: "陆羽", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", isViewed: false },
  { id: "s2", name: "林清", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", isViewed: false },
  { id: "s3", name: "老陈", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100", isViewed: true },
  { id: "s4", name: "小禾", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100", isViewed: false },
];

export const posts: Post[] = [
  {
    id: "p1",
    type: "photo",
    author: "苏曼",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
    time: "2小时前",
    location: "杭州",
    image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800",
    caption: "晨起一盏西湖龙井，叶片在水中翩跹，是春天的味道。",
    likes: 128,
    comments: 24,
  },
  {
    id: "p2",
    type: "brewing",
    author: "顾先生",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
    time: "5小时前",
    teaName: "武夷岩茶",
    brewingData: { temp: "98°C", time: "30秒", amount: "8g" },
    brewingImages: [
      "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=400",
      "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400",
    ],
    quote: "岩韵十足，回甘极快。",
  },
  {
    id: "p3",
    type: "question",
    author: "泡茶新手小白",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
    time: "昨天",
    title: "建盏需要如何"养"才会有七彩光？",
    description: "刚入手了一只油滴建盏，听说养好了会有七彩光，求大神指导正确的养盏方法！",
    answerCount: 12,
  },
];
```

**Step 2: 创建社区 Tabs**

创建 `src/components/community/CommunityTabs.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";

const TABS = ["动态", "话题", "茶会"] as const;

interface Props {
  selected: string;
  onSelect: (tab: string) => void;
}

export default function CommunityTabs({ selected, onSelect }: Props) {
  return (
    <View className="flex-row gap-6 px-1">
      {TABS.map((tab) => (
        <Pressable key={tab} onPress={() => onSelect(tab)} className="pb-2 relative">
          <Text className={`text-base ${selected === tab ? "text-on-surface font-bold" : "text-secondary/60"}`}>
            {tab}
          </Text>
          {selected === tab && (
            <View className="absolute bottom-0 left-0 right-0 h-1 bg-primary-container rounded-full" />
          )}
        </Pressable>
      ))}
    </View>
  );
}
```

**Step 3: 创建故事行**

创建 `src/components/community/StoryRow.tsx`：

```typescript
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
            <Image source={{ uri: story.avatar }} className="w-12 h-12 rounded-full" contentFit="cover" />
          </View>
          <Text className="text-on-surface text-[10px] font-medium" numberOfLines={1}>{story.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

**Step 4: 创建帖子卡片（支持三种类型）**

创建 `src/components/community/PostCard.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { Post } from "@/data/community";

export default function PostCard({ post }: { post: Post }) {
  if (post.type === "photo") return <PhotoPost post={post} />;
  if (post.type === "brewing") return <BrewingPost post={post} />;
  return <QuestionPost post={post} />;
}

function PostHeader({ post }: { post: Post }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2.5">
        <Image source={{ uri: post.avatar }} className="w-10 h-10 rounded-full" contentFit="cover" />
        <View>
          <Text className="text-on-surface text-sm font-bold">{post.author}</Text>
          <Text className="text-secondary/60 text-[11px]">
            {post.time}{post.location ? ` · ${post.location}` : ""}
          </Text>
        </View>
      </View>
      <Pressable hitSlop={8}>
        <MaterialIcons name="more-horiz" size={20} color={Colors.outline} />
      </Pressable>
    </View>
  );
}

function PhotoPost({ post }: { post: Post }) {
  return (
    <View className="gap-3">
      <PostHeader post={post} />
      {post.image && (
        <Image source={{ uri: post.image }} className="w-full h-72 rounded-xl" contentFit="cover" />
      )}
      <Text className="text-on-surface text-[15px] leading-relaxed">{post.caption}</Text>
      <View className="flex-row justify-between items-center">
        <View className="flex-row gap-5">
          <Pressable className="flex-row items-center gap-1">
            <MaterialIcons name="favorite-border" size={20} color={Colors.secondary} />
            <Text className="text-secondary text-sm">{post.likes}</Text>
          </Pressable>
          <Pressable className="flex-row items-center gap-1">
            <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.secondary} />
            <Text className="text-secondary text-sm">{post.comments}</Text>
          </Pressable>
        </View>
        <View className="flex-row gap-4">
          <Pressable hitSlop={8}>
            <MaterialIcons name="bookmark-border" size={20} color={Colors.secondary} />
          </Pressable>
          <Pressable hitSlop={8}>
            <MaterialIcons name="share" size={20} color={Colors.secondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function BrewingPost({ post }: { post: Post }) {
  return (
    <View className="bg-surface-container-low rounded-2xl border-l-4 border-primary-container p-5 gap-3">
      <View className="flex-row items-center gap-2">
        <View className="bg-primary-container/20 px-2 py-0.5 rounded">
          <Text className="text-primary text-[10px] font-bold">冲泡分享</Text>
        </View>
        <Text className="text-on-surface text-sm font-bold">{post.author}</Text>
      </View>
      {post.brewingImages && (
        <View className="flex-row gap-2">
          {post.brewingImages.map((img, i) => (
            <Image key={i} source={{ uri: img }} className="flex-1 h-32 rounded-lg" contentFit="cover" />
          ))}
        </View>
      )}
      <View className="bg-surface p-3 rounded-lg gap-2">
        <View className="bg-secondary-container/30 self-start px-2 py-0.5 rounded">
          <Text className="text-secondary text-[10px]">{post.teaName}</Text>
        </View>
        {post.brewingData && (
          <View className="flex-row gap-4">
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="thermostat" size={14} color={Colors.outline} />
              <Text className="text-on-surface text-xs">{post.brewingData.temp}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="schedule" size={14} color={Colors.outline} />
              <Text className="text-on-surface text-xs">{post.brewingData.time}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="scale" size={14} color={Colors.outline} />
              <Text className="text-on-surface text-xs">{post.brewingData.amount}</Text>
            </View>
          </View>
        )}
        {post.quote && (
          <Text className="text-secondary italic text-sm">"{post.quote}"</Text>
        )}
      </View>
    </View>
  );
}

function QuestionPost({ post }: { post: Post }) {
  return (
    <View className="bg-surface-container-highest/40 p-6 rounded-3xl gap-3">
      <View className="bg-tertiary-fixed self-start px-2.5 py-0.5 rounded-full">
        <Text className="text-on-surface text-[10px] font-bold">求助</Text>
      </View>
      <Text className="font-headline text-on-surface text-lg font-bold">{post.title}</Text>
      <Text className="text-on-surface/80 text-sm leading-relaxed">{post.description}</Text>
      <View className="flex-row justify-between items-center pt-2">
        <Text className="text-outline text-xs">{post.answerCount}+ 人已回答</Text>
        <Pressable className="bg-primary px-5 py-2 rounded-full active:opacity-80">
          <Text className="text-on-primary text-sm font-medium">我来回答</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

**Step 5: 组装社区页面**

修改 `src/app/(tabs)/community.tsx`：

```typescript
import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { posts } from "@/data/community";
import CommunityTabs from "@/components/community/CommunityTabs";
import StoryRow from "@/components/community/StoryRow";
import PostCard from "@/components/community/PostCard";

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("动态");

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
```

**Step 6: 提交**

```bash
git add src/data/community.ts src/components/community/ src/app/(tabs)/community.tsx
git commit -m "feat: 社区动态页（故事行/图文帖/冲泡分享/求助帖/FAB）"
```

---

## Task 4: 最终验证

```bash
npx tsc --noEmit
git add -A
git commit -m "chore: Sprint 4 完成 — 茶道+搜索+社区"
```

---

## Sprint 4 交付清单

| 交付物 | 状态 |
|--------|------|
| 茶道内容页（精选文章/分类/冲泡指南/节气推荐） | ✅ |
| 搜索页面（历史标签/热搜排行/猜你喜欢） | ✅ |
| 社区动态页（故事行/三种帖子类型/FAB） | ✅ |
| 文章数据模型 + 社区数据模型 | ✅ |
| 可复用组件 x15+ | ✅ |
