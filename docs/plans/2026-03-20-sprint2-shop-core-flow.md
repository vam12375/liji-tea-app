# Sprint 2: 商城核心流程 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现商城列表页（筛选/排序）、茶品详情页（沉浸式布局）、购物车功能（Zustand 状态管理），完成核心购物流程闭环。

**Architecture:** 商城列表使用 FlashList/FlatList 虚拟化列表 + 分类筛选状态。详情页通过 Expo Router 动态路由 `product/[id]`。购物车使用 Zustand 全局状态管理，数据持久化到 AsyncStorage。所有页面复用 Sprint 1 的设计 Token 体系。

**Tech Stack:** 基于 Sprint 1 + zustand, @react-native-async-storage/async-storage

---

## Task 1: 安装新依赖 + 扩展数据模型

**Files:**
- Modify: `package.json`
- Modify: `src/data/products.ts`

**Step 1: 安装依赖**

```bash
cd E:/liji-tea-app
npx expo install zustand @react-native-async-storage/async-storage
```

**Step 2: 扩展产品数据模型**

修改 `src/data/products.ts`，扩展 Product 接口并增加商城用完整数据：

```typescript
export interface TastingProfile {
  label: string;
  description: string;
  value: number; // 0-100
}

export interface BrewingGuide {
  temperature: string;
  time: string;
  amount: string;
  equipment: string;
}

export interface Product {
  id: string;
  name: string;
  origin: string;
  price: number;
  unit: string;
  image: string;
  description?: string;
  isNew?: boolean;
  category: string;
  tagline?: string;
  tastingProfile?: TastingProfile[];
  brewingGuide?: BrewingGuide;
  originStory?: string;
  process?: string[];
}

/** 商城完整产品列表 */
export const allProducts: Product[] = [
  {
    id: "1",
    name: "特级大红袍",
    origin: "福建·武夷山",
    price: 398,
    unit: "50g",
    image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=400",
    category: "岩茶",
    tagline: "岩骨花香，回甘悠长",
    tastingProfile: [
      { label: "香气", description: "兰花香", value: 85 },
      { label: "滋味", description: "醇厚饱满", value: 92 },
      { label: "回甘", description: "岩韵悠长", value: 78 },
    ],
    brewingGuide: {
      temperature: "98°C",
      time: "30秒",
      amount: "8g",
      equipment: "盖碗",
    },
    originStory: "武夷山独特的丹霞地貌，赋予岩茶独一无二的岩骨花香。生长于岩缝之间的茶树，根深叶茂，吸收矿物质丰富，造就了大红袍醇厚饱满的口感。",
    process: ["采摘", "萎凋", "做青", "炭焙"],
  },
  {
    id: "2",
    name: "西湖龙井",
    origin: "浙江·杭州",
    price: 256,
    unit: "50g",
    image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400",
    category: "绿茶",
    tagline: "色绿香郁味甘形美",
    tastingProfile: [
      { label: "香气", description: "豆花香", value: 90 },
      { label: "滋味", description: "鲜爽甘醇", value: 88 },
      { label: "回甘", description: "清新持久", value: 82 },
    ],
    brewingGuide: {
      temperature: "80°C",
      time: "45秒",
      amount: "5g",
      equipment: "玻璃杯",
    },
    originStory: "西湖龙井产于杭州西湖周围的群山之中，以色绿、香郁、味甘、形美四绝著称，位列中国十大名茶之首。",
    process: ["采摘", "摊放", "杀青", "辉锅"],
  },
  {
    id: "3",
    name: "古树普洱生茶",
    origin: "云南·勐海",
    price: 588,
    unit: "片",
    image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400",
    category: "普洱",
    tagline: "古树韵味，越陈越香",
    tastingProfile: [
      { label: "香气", description: "蜜兰香", value: 88 },
      { label: "滋味", description: "浓厚霸气", value: 95 },
      { label: "回甘", description: "深沉绵长", value: 90 },
    ],
    brewingGuide: {
      temperature: "100°C",
      time: "15秒",
      amount: "7g",
      equipment: "紫砂壶",
    },
    originStory: "勐海古茶山的百年古树，每一片茶叶都蕴含着时间的味道。古树根系深扎土壤，汲取丰富矿物质，造就浓厚霸气的口感。",
    process: ["采摘", "萎凋", "杀青", "压制"],
  },
  {
    id: "4",
    name: "白毫银针",
    origin: "福建·福鼎",
    price: 420,
    unit: "50g",
    image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400",
    category: "白茶",
    tagline: "满披白毫，如银似雪",
    isNew: true,
    tastingProfile: [
      { label: "香气", description: "毫香幽显", value: 80 },
      { label: "滋味", description: "清鲜淡雅", value: 75 },
      { label: "回甘", description: "甜润悠长", value: 85 },
    ],
    brewingGuide: {
      temperature: "85°C",
      time: "60秒",
      amount: "5g",
      equipment: "盖碗",
    },
    originStory: "福鼎白茶以白毫银针为最，取自大白茶品种的肥壮芽头，满披白毫，外形如银似雪，汤色杏黄明亮。",
    process: ["采摘", "萎凋", "干燥"],
  },
  {
    id: "5",
    name: "金骏眉红茶",
    origin: "福建·武夷山",
    price: 680,
    unit: "50g",
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
    category: "红茶",
    tagline: "花果蜜香，汤色金黄",
    isNew: true,
    tastingProfile: [
      { label: "香气", description: "花果蜜香", value: 93 },
      { label: "滋味", description: "甜润饱满", value: 90 },
      { label: "回甘", description: "蜜韵悠长", value: 88 },
    ],
    brewingGuide: {
      temperature: "90°C",
      time: "40秒",
      amount: "5g",
      equipment: "盖碗",
    },
    originStory: "金骏眉采用桐木关原生态小种红茶的芽尖制作，每500克成品需要约6万颗芽尖，是顶级红茶的代表。",
    process: ["采摘", "萎凋", "揉捻", "发酵", "烘焙"],
  },
  {
    id: "6",
    name: "特级茉莉花茶",
    origin: "广西·横县",
    price: 128,
    unit: "100g",
    image: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=400",
    category: "花茶",
    tagline: "窨得茉莉无上味，列作人间第一香",
    tastingProfile: [
      { label: "香气", description: "茉莉花香", value: 95 },
      { label: "滋味", description: "鲜灵甘爽", value: 82 },
      { label: "回甘", description: "花香回味", value: 80 },
    ],
    brewingGuide: {
      temperature: "85°C",
      time: "45秒",
      amount: "5g",
      equipment: "玻璃杯",
    },
    originStory: "横县茉莉花茶采用优质绿茶坯与含苞待放的茉莉花反复窨制而成，花香与茶香交融，堪称花茶之王。",
    process: ["选坯", "窨花", "通花", "起花", "复火"],
  },
];

/** 茶类分类 */
export const TEA_CATEGORIES = [
  "全部", "岩茶", "绿茶", "白茶", "红茶", "乌龙", "普洱", "花茶",
] as const;

export type TeaCategory = (typeof TEA_CATEGORIES)[number];

/** 保留向后兼容 - Sprint 1 首页使用 */
export const featuredProducts = allProducts.slice(0, 3);
export const newArrivals = allProducts.filter((p) => p.isNew);
```

**Step 3: 提交**

```bash
git add package.json package-lock.json src/data/products.ts
git commit -m "feat: 安装 zustand + 扩展产品数据模型"
```

---

## Task 2: Zustand 购物车状态管理

**Files:**
- Create: `src/stores/cartStore.ts`

**Step 1: 创建购物车 Store**

创建 `src/stores/cartStore.ts`：

```typescript
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Product } from "@/data/products";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  /** 商品总数 */
  totalItems: () => number;
  /** 小计金额 */
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) =>
        set((state) => {
          const existing = state.items.find(
            (item) => item.product.id === product.id
          );
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              ),
            };
          }
          return { items: [...state.items, { product, quantity: 1 }] };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.product.id !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter(
                (item) => item.product.id !== productId
              ),
            };
          }
          return {
            items: state.items.map((item) =>
              item.product.id === productId ? { ...item, quantity } : item
            ),
          };
        }),

      clearCart: () => set({ items: [] }),

      totalItems: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      subtotal: () =>
        get().items.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        ),
    }),
    {
      name: "liji-cart",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**Step 2: 提交**

```bash
git add src/stores/cartStore.ts
git commit -m "feat: Zustand 购物车状态管理（增删改查 + 持久化）"
```

---

## Task 3: 商城列表页

**Files:**
- Modify: `src/app/(tabs)/shop.tsx`
- Create: `src/components/shop/SearchBar.tsx`
- Create: `src/components/shop/FilterChips.tsx`
- Create: `src/components/shop/ShopProductCard.tsx`

**Step 1: 创建搜索栏组件**

创建 `src/components/shop/SearchBar.tsx`：

```typescript
import { View, TextInput, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export default function SearchBar({ value, onChangeText }: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-surface-container-high rounded-full px-4 h-11 gap-2">
      <MaterialIcons name="search" size={20} color={Colors.outline} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="搜索茶品..."
        placeholderTextColor={Colors.outline}
        className="flex-1 text-on-surface text-sm font-body"
        returnKeyType="search"
      />
      <Pressable hitSlop={8}>
        <MaterialIcons name="photo-camera" size={20} color={Colors.outline} />
      </Pressable>
    </View>
  );
}
```

**Step 2: 创建筛选标签组件**

创建 `src/components/shop/FilterChips.tsx`：

```typescript
import { ScrollView, Pressable, Text } from "react-native";
import { TEA_CATEGORIES, type TeaCategory } from "@/data/products";

interface FilterChipsProps {
  selected: TeaCategory;
  onSelect: (category: TeaCategory) => void;
}

export default function FilterChips({ selected, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-1"
    >
      {TEA_CATEGORIES.map((cat) => (
        <Pressable
          key={cat}
          onPress={() => onSelect(cat)}
          className={`px-4 py-2 rounded-full ${
            selected === cat
              ? "bg-primary-container"
              : "border border-outline-variant"
          }`}
        >
          <Text
            className={`text-sm ${
              selected === cat
                ? "text-on-primary font-medium"
                : "text-on-surface-variant"
            }`}
          >
            {cat}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

**Step 3: 创建商城产品卡片（网格版）**

创建 `src/components/shop/ShopProductCard.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { Product } from "@/data/products";

interface ShopProductCardProps {
  product: Product;
  onPress?: () => void;
}

export default function ShopProductCard({
  product,
  onPress,
}: ShopProductCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-surface-container-low rounded-xl overflow-hidden active:opacity-80"
    >
      {/* 产品图片 - 4:5 比例 */}
      <View className="aspect-[4/5] overflow-hidden">
        <Image
          source={{ uri: product.image }}
          className="w-full h-full"
          contentFit="cover"
          transition={200}
        />
      </View>

      {/* 产品信息 */}
      <View className="p-3 gap-1.5">
        <Text className="font-headline text-on-surface text-sm" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="text-[10px] text-outline">{product.origin}</Text>
        <View className="flex-row justify-between items-center">
          <Text className="text-primary font-bold text-base">
            ¥{product.price}
            <Text className="text-outline text-[10px] font-normal">
              /{product.unit}
            </Text>
          </Text>
          <Pressable hitSlop={8}>
            <MaterialIcons
              name="favorite-border"
              size={18}
              color={Colors.outline}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
```

**Step 4: 实现商城列表页**

修改 `src/app/(tabs)/shop.tsx`：

```typescript
import { useState, useMemo } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import SearchBar from "@/components/shop/SearchBar";
import FilterChips from "@/components/shop/FilterChips";
import ShopProductCard from "@/components/shop/ShopProductCard";
import { allProducts, type TeaCategory } from "@/data/products";

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TeaCategory>("全部");

  // 筛选产品
  const filteredProducts = useMemo(() => {
    let result = allProducts;
    if (category !== "全部") {
      result = result.filter((p) => p.category === category);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.origin.toLowerCase().includes(q)
      );
    }
    return result;
  }, [category, search]);

  return (
    <View className="flex-1 bg-background">
      {/* 顶部导航 */}
      <View style={{ paddingTop: insets.top }} className="px-4 pb-3 bg-background">
        <View className="flex-row justify-between items-center h-14">
          <View className="flex-row items-center gap-3">
            <MaterialIcons name="menu" size={24} color={Colors.primary} />
            <Text className="font-headline text-2xl tracking-widest font-bold text-primary">
              李记茶
            </Text>
          </View>
          <Pressable hitSlop={8}>
            <MaterialIcons name="search" size={24} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperClassName="gap-3 px-4"
        contentContainerClassName="gap-4 pb-8"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-4 px-4">
            <SearchBar value={search} onChangeText={setSearch} />
            <FilterChips selected={category} onSelect={setCategory} />
            {/* 排序行 */}
            <View className="flex-row justify-between items-center">
              <Text className="text-on-surface-variant text-sm">
                {filteredProducts.length} 款茶品
              </Text>
              <Pressable className="flex-row items-center gap-1">
                <Text className="text-on-surface-variant text-sm">排序: 推荐</Text>
                <MaterialIcons
                  name="expand-more"
                  size={18}
                  color={Colors.outline}
                />
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ShopProductCard
            product={item}
            onPress={() => router.push(`/product/${item.id}`)}
          />
        )}
      />
    </View>
  );
}
```

**Step 5: 提交**

```bash
git add src/app/(tabs)/shop.tsx src/components/shop/
git commit -m "feat: 商城列表页（搜索 + 分类筛选 + 产品网格）"
```

---

## Task 4: 茶品详情页

**Files:**
- Create: `src/app/product/[id].tsx`
- Create: `src/components/product/TastingProfile.tsx`
- Create: `src/components/product/BrewingGuideCard.tsx`
- Create: `src/components/product/ProcessTimeline.tsx`

**Step 1: 创建风味赏析组件**

创建 `src/components/product/TastingProfile.tsx`：

```typescript
import { View, Text } from "react-native";
import type { TastingProfile as TastingProfileType } from "@/data/products";

interface TastingProfileProps {
  items: TastingProfileType[];
}

export default function TastingProfile({ items }: TastingProfileProps) {
  return (
    <View className="gap-4">
      <Text className="font-headline text-lg text-on-surface">风味赏析</Text>
      <View className="gap-5">
        {items.map((item) => (
          <View key={item.label} className="gap-2">
            <View className="flex-row justify-between items-center">
              <Text className="text-on-surface text-sm font-medium">
                {item.label}
              </Text>
              <Text className="text-outline text-xs">{item.description}</Text>
            </View>
            {/* 进度条 */}
            <View className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <View
                className="h-full bg-primary-container rounded-full"
                style={{ width: `${item.value}%` }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
```

**Step 2: 创建冲泡指南组件**

创建 `src/components/product/BrewingGuideCard.tsx`：

```typescript
import { View, Text } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { BrewingGuide } from "@/data/products";

const GUIDE_ITEMS = [
  { key: "temperature" as const, icon: "thermostat" as const, label: "水温" },
  { key: "time" as const, icon: "timer" as const, label: "时间" },
  { key: "amount" as const, icon: "scale" as const, label: "用量" },
  { key: "equipment" as const, icon: "coffee-maker" as const, label: "器具" },
];

interface BrewingGuideCardProps {
  guide: BrewingGuide;
}

export default function BrewingGuideCard({ guide }: BrewingGuideCardProps) {
  return (
    <View className="gap-4">
      <Text className="font-headline text-lg text-on-surface">冲泡指南</Text>
      <View className="flex-row flex-wrap gap-3">
        {GUIDE_ITEMS.map((item) => (
          <View
            key={item.key}
            className="flex-1 min-w-[45%] bg-surface-container-low rounded-xl p-4 items-center gap-2"
          >
            <MaterialIcons
              name={item.icon}
              size={28}
              color={Colors.primaryContainer}
            />
            <Text className="text-outline text-xs">{item.label}</Text>
            <Text className="text-on-surface font-medium text-sm">
              {guide[item.key]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
```

**Step 3: 创建制作工艺时间线组件**

创建 `src/components/product/ProcessTimeline.tsx`：

```typescript
import { View, Text } from "react-native";
import { Colors } from "@/constants/Colors";

interface ProcessTimelineProps {
  steps: string[];
}

export default function ProcessTimeline({ steps }: ProcessTimelineProps) {
  return (
    <View className="gap-4">
      <Text className="font-headline text-lg text-on-surface">制作工艺</Text>
      <View className="gap-0">
        {steps.map((step, index) => (
          <View key={step} className="flex-row items-start gap-4">
            {/* 时间线圆点 + 连线 */}
            <View className="items-center w-6">
              <View
                className={`w-3 h-3 rounded-full ${
                  index === 0 ? "bg-primary-container" : "bg-outline-variant"
                }`}
              />
              {index < steps.length - 1 && (
                <View className="w-px h-8 bg-outline-variant" />
              )}
            </View>
            {/* 步骤文字 */}
            <Text
              className={`text-sm pb-5 ${
                index === 0
                  ? "text-on-surface font-medium"
                  : "text-outline"
              }`}
            >
              {step}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
```

**Step 4: 创建产品详情页**

创建 `src/app/product/[id].tsx`：

```typescript
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { allProducts } from "@/data/products";
import { useCartStore } from "@/stores/cartStore";
import TastingProfile from "@/components/product/TastingProfile";
import BrewingGuideCard from "@/components/product/BrewingGuideCard";
import ProcessTimeline from "@/components/product/ProcessTimeline";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addItem = useCartStore((s) => s.addItem);
  const totalItems = useCartStore((s) => s.totalItems);

  const product = allProducts.find((p) => p.id === id);
  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-outline">产品未找到</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero 图片 */}
        <View className="h-[360px] relative">
          <Image
            source={{ uri: product.image }}
            className="w-full h-full"
            contentFit="cover"
            transition={300}
          />
          <View className="absolute inset-0 bg-black/30" />

          {/* 顶部导航按钮 */}
          <View
            style={{ paddingTop: insets.top }}
            className="absolute top-0 left-0 right-0 flex-row justify-between items-center px-4"
          >
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <View className="flex-row gap-3">
              <Pressable className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center">
                <MaterialIcons name="share" size={22} color="#fff" />
              </Pressable>
              <Pressable className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center">
                <MaterialIcons name="favorite-border" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* 内容卡片 - 上移覆盖 */}
        <View className="bg-background rounded-t-3xl -mt-8 pt-8 px-6 pb-32 gap-8">
          {/* 基本信息 */}
          <View className="gap-2">
            <Text className="font-headline text-3xl text-on-surface font-bold">
              {product.name}
            </Text>
            <Text className="text-outline text-sm">{product.origin}</Text>
            {product.tagline && (
              <Text className="text-on-surface-variant text-sm italic mt-1">
                "{product.tagline}"
              </Text>
            )}
            <Text className="text-primary text-2xl font-bold mt-3">
              ¥{product.price}
              <Text className="text-outline text-sm font-normal">
                /{product.unit}
              </Text>
            </Text>
          </View>

          {/* 风味赏析 */}
          {product.tastingProfile && (
            <TastingProfile items={product.tastingProfile} />
          )}

          {/* 冲泡指南 */}
          {product.brewingGuide && (
            <BrewingGuideCard guide={product.brewingGuide} />
          )}

          {/* 产地故事 */}
          {product.originStory && (
            <View className="gap-3">
              <Text className="font-headline text-lg text-on-surface">
                产地故事
              </Text>
              <Text className="text-on-surface-variant text-sm leading-relaxed">
                {product.originStory}
              </Text>
            </View>
          )}

          {/* 制作工艺 */}
          {product.process && <ProcessTimeline steps={product.process} />}
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3 flex-row items-center gap-3"
      >
        {/* 购物车图标 */}
        <Pressable
          onPress={() => router.push("/cart")}
          className="w-12 h-12 rounded-full border border-outline-variant items-center justify-center relative"
        >
          <MaterialIcons name="shopping-cart" size={22} color={Colors.primary} />
          {totalItems() > 0 && (
            <View className="absolute -top-1 -right-1 bg-error w-5 h-5 rounded-full items-center justify-center">
              <Text className="text-on-error text-[10px] font-bold">
                {totalItems()}
              </Text>
            </View>
          )}
        </Pressable>

        {/* 加入购物车 */}
        <Pressable
          onPress={() => addItem(product)}
          className="flex-1 bg-surface-container-high h-12 rounded-full items-center justify-center active:bg-surface-container-highest"
        >
          <Text className="text-on-surface font-medium">加入购物车</Text>
        </Pressable>

        {/* 立即购买 */}
        <Pressable className="flex-1 bg-primary-container h-12 rounded-full items-center justify-center active:bg-primary">
          <Text className="text-on-primary font-medium">立即购买</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

**Step 5: 提交**

```bash
git add src/app/product/ src/components/product/
git commit -m "feat: 茶品详情页（沉浸式布局 + 风味/冲泡/工艺）"
```

---

## Task 5: 购物车页面

**Files:**
- Create: `src/app/cart.tsx`
- Create: `src/components/cart/CartItemCard.tsx`
- Create: `src/components/cart/OrderSummary.tsx`

**Step 1: 创建购物车商品卡片**

创建 `src/components/cart/CartItemCard.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { CartItem } from "@/stores/cartStore";

interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export default function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemCardProps) {
  const { product, quantity } = item;

  return (
    <View className="flex-row bg-surface-container-low rounded-xl p-3 gap-3 active:scale-[0.98]">
      {/* 产品图片 */}
      <Image
        source={{ uri: product.image }}
        className="w-20 h-20 rounded-lg"
        contentFit="cover"
      />

      {/* 产品信息 */}
      <View className="flex-1 justify-between">
        <View>
          <Text className="font-headline text-on-surface text-sm" numberOfLines={1}>
            {product.name}
          </Text>
          <Text className="text-[10px] text-outline mt-0.5">
            {product.origin}
          </Text>
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-primary font-bold">¥{product.price}</Text>

          {/* 数量控制 */}
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => onUpdateQuantity(quantity - 1)}
              className="w-7 h-7 rounded-full border border-outline-variant items-center justify-center"
            >
              <MaterialIcons name="remove" size={16} color={Colors.outline} />
            </Pressable>
            <Text className="text-on-surface text-sm w-5 text-center">
              {quantity}
            </Text>
            <Pressable
              onPress={() => onUpdateQuantity(quantity + 1)}
              className="w-7 h-7 rounded-full border border-outline-variant items-center justify-center"
            >
              <MaterialIcons name="add" size={16} color={Colors.outline} />
            </Pressable>
          </View>
        </View>

        {/* 删除按钮 */}
        <Pressable onPress={onRemove} className="self-end mt-1">
          <Text className="text-outline text-[10px]">删除</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

**Step 2: 创建订单摘要组件**

创建 `src/components/cart/OrderSummary.tsx`：

```typescript
import { View, Text } from "react-native";

interface OrderSummaryProps {
  subtotal: number;
  shipping: number;
  discount: number;
}

export default function OrderSummary({
  subtotal,
  shipping,
  discount,
}: OrderSummaryProps) {
  const total = subtotal + shipping - discount;

  return (
    <View className="bg-surface-container-low rounded-xl p-4 gap-3">
      <SummaryRow label="小计" value={`¥${subtotal}`} />
      <SummaryRow
        label="运费"
        value={shipping === 0 ? "¥0" : `¥${shipping}`}
        badge={shipping === 0 ? "包邮" : undefined}
      />
      {discount > 0 && (
        <SummaryRow
          label="优惠"
          value={`-¥${discount}`}
          valueColor="text-error"
          badge={`已优惠¥${discount}`}
        />
      )}
      <View className="h-px bg-outline-variant/20 my-1" />
      <View className="flex-row justify-between items-center">
        <Text className="text-on-surface font-medium">合计</Text>
        <Text className="text-primary text-xl font-bold">¥{total}</Text>
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  valueColor = "text-on-surface",
  badge,
}: {
  label: string;
  value: string;
  valueColor?: string;
  badge?: string;
}) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-outline text-sm">{label}</Text>
      <View className="flex-row items-center gap-2">
        {badge && (
          <View className="bg-tertiary-fixed/30 px-2 py-0.5 rounded">
            <Text className="text-tertiary text-[10px]">{badge}</Text>
          </View>
        )}
        <Text className={`${valueColor} text-sm`}>{value}</Text>
      </View>
    </View>
  );
}
```

**Step 3: 创建购物车页面**

创建 `src/app/cart.tsx`：

```typescript
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useCartStore } from "@/stores/cartStore";
import CartItemCard from "@/components/cart/CartItemCard";
import OrderSummary from "@/components/cart/OrderSummary";

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, updateQuantity, removeItem, subtotal, totalItems } =
    useCartStore();

  const isEmpty = items.length === 0;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "购物车",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable hitSlop={8}>
              <Text className="text-tertiary text-sm">编辑</Text>
            </Pressable>
          ),
        }}
      />

      {isEmpty ? (
        /* 空购物车 */
        <View className="flex-1 items-center justify-center gap-4">
          <MaterialIcons name="shopping-cart" size={64} color={Colors.outlineVariant} />
          <Text className="text-outline text-base">购物车是空的</Text>
          <Pressable
            onPress={() => router.push("/(tabs)/shop")}
            className="bg-primary-container px-6 py-2.5 rounded-full"
          >
            <Text className="text-on-primary font-medium">去逛逛</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-4 py-4 gap-3 pb-44"
            showsVerticalScrollIndicator={false}
          >
            {/* 购物车商品列表 */}
            {items.map((item) => (
              <CartItemCard
                key={item.product.id}
                item={item}
                onUpdateQuantity={(qty) =>
                  updateQuantity(item.product.id, qty)
                }
                onRemove={() => removeItem(item.product.id)}
              />
            ))}

            {/* 优惠码 */}
            <View className="flex-row border border-dashed border-outline-variant rounded-xl overflow-hidden mt-4">
              <TextInput
                placeholder="输入优惠码"
                placeholderTextColor={Colors.outline}
                className="flex-1 px-4 py-3 text-sm text-on-surface"
              />
              <Pressable className="bg-primary-container px-5 items-center justify-center">
                <Text className="text-on-primary text-sm font-medium">使用</Text>
              </Pressable>
            </View>

            {/* 订单摘要 */}
            <OrderSummary
              subtotal={subtotal()}
              shipping={0}
              discount={subtotal() >= 1000 ? 50 : 0}
            />
          </ScrollView>

          {/* 底部结算栏 */}
          <View
            style={{ paddingBottom: insets.bottom || 16 }}
            className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3 flex-row items-center justify-between"
          >
            <View>
              <Text className="text-outline text-xs">合计</Text>
              <Text className="text-primary text-xl font-bold">
                ¥{subtotal() - (subtotal() >= 1000 ? 50 : 0)}
              </Text>
            </View>
            <Pressable className="bg-primary-container px-8 py-3 rounded-full active:bg-primary">
              <Text className="text-on-primary font-medium">
                去结算 ({totalItems()})
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
```

**Step 4: 提交**

```bash
git add src/app/cart.tsx src/components/cart/
git commit -m "feat: 购物车页面（商品管理 + 优惠码 + 订单摘要 + 结算）"
```

---

## Task 6: 最终集成 + 验证

**Step 1: 确保路由正确**

在 `src/app/_layout.tsx` 中，Stack 应该能自动发现 `product/[id]` 和 `cart` 路由。无需额外配置。

**Step 2: TypeScript 检查**

```bash
cd E:/liji-tea-app
npx tsc --noEmit
```

修复所有错误。

**Step 3: 提交**

```bash
git add -A
git commit -m "chore: Sprint 2 完成 — 商城列表 + 产品详情 + 购物车"
```

---

## Sprint 2 交付清单

| 交付物 | 状态 |
|--------|------|
| Zustand 购物车状态管理（增删改查 + AsyncStorage 持久化）| ✅ |
| 扩展产品数据模型（风味/冲泡/工艺/产地故事）| ✅ |
| 商城列表页（搜索 + 8 分类筛选 + 2 列产品网格）| ✅ |
| 茶品详情页（沉浸式 Hero + 风味赏析 + 冲泡指南 + 制作工艺）| ✅ |
| 购物车页面（数量控制 + 优惠码 + 订单摘要 + 结算按钮）| ✅ |
| 可复用组件：ProductCard / TastingProfile / BrewingGuideCard / ProcessTimeline / CartItemCard / OrderSummary | ✅ |
