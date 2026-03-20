# Sprint 1: 项目框架 + 首页 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 从零初始化 React Native + Expo 项目，集成设计系统，搭建底部 Tab 导航，完成首页全部 UI。

**Architecture:** 使用 Expo SDK 55 + Expo Router 文件式路由 + NativeWind v5 (Tailwind CSS v4) 构建移动端应用。采用组件化架构，将首页拆分为 HeroBanner、CategoryRow、FeaturedProducts、NewArrivals 等独立组件。设计 Token 通过 Tailwind CSS 的 `@theme` 配置统一管理。

**Tech Stack:** Expo SDK 55, Expo Router, NativeWind v5 (preview), Tailwind CSS v4, TypeScript, React Native Reanimated, expo-image, @expo/vector-icons

---

## Task 1: 项目初始化

**Files:**
- Create: `E:/liji-tea-app/` (Expo 项目根目录)

**Step 1: 创建 Expo 项目**

在 `E:/liji-tea-app` 的**父目录**创建项目（因为当前目录已存在非代码文件）：

```bash
cd E:/
npx create-expo-app@latest liji-tea-app-src --template default@sdk-55
```

> 注意：由于 `E:/liji-tea-app` 已有设计文件，我们先创建到 `liji-tea-app-src`，然后将生成的项目文件移入 `liji-tea-app`。

**Step 2: 将项目文件合并到 liji-tea-app**

```bash
# 将 src 项目中的所有文件（除 .git）移动到目标目录
cd E:/liji-tea-app-src
cp -r ./* E:/liji-tea-app/
cp -r ./.[!.]* E:/liji-tea-app/ 2>/dev/null
cd E:/liji-tea-app
rm -rf E:/liji-tea-app-src
```

**Step 3: 清理模板代码**

```bash
cd E:/liji-tea-app
npm run reset-project
```

这会将模板示例文件移到 `app-example/`，清空 `app/` 目录准备从头开发。

**Step 4: 验证项目启动**

```bash
cd E:/liji-tea-app
npx expo start
```

按 `a` 启动 Android 模拟器或扫码调试，确认 Hello World 能正常运行。

**Step 5: 初始化 Git 仓库**

```bash
cd E:/liji-tea-app
git init
git add -A
git commit -m "chore: 初始化 Expo SDK 55 项目"
```

---

## Task 2: 安装 NativeWind v5 + 配置 Tailwind CSS

**Files:**
- Create: `global.css`
- Create: `postcss.config.mjs`
- Modify: `metro.config.js`
- Modify: `app/_layout.tsx`

**Step 1: 安装 NativeWind 及依赖**

```bash
cd E:/liji-tea-app

# 安装 NativeWind v5 和运行时依赖
npx expo install nativewind@preview react-native-css react-native-reanimated react-native-safe-area-context

# 安装 Tailwind CSS v4 和 PostCSS（开发依赖）
npx expo install --dev tailwindcss @tailwindcss/postcss postcss
```

**Step 2: 创建 PostCSS 配置**

创建 `postcss.config.mjs`：

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**Step 3: 配置 Metro Bundler**

修改 `metro.config.js`：

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config);
```

**Step 4: 创建全局 CSS 文件**

创建 `global.css`：

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

@import "nativewind/theme";
```

**Step 5: 在根布局中引入全局 CSS**

修改 `app/_layout.tsx`，在文件顶部添加：

```typescript
import "../global.css";
```

**Step 6: 验证 NativeWind 工作正常**

在 `app/index.tsx` 中写一个测试组件：

```typescript
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-green-700">
        NativeWind 已就绪！
      </Text>
    </View>
  );
}
```

运行 `npx expo start --clear` 确认绿色文字正常显示。

**Step 7: 提交**

```bash
git add postcss.config.mjs metro.config.js global.css app/_layout.tsx app/index.tsx package.json package-lock.json
git commit -m "chore: 集成 NativeWind v5 + Tailwind CSS v4"
```

---

## Task 3: 建立设计系统 Token

**Files:**
- Modify: `global.css` (添加设计 Token)
- Create: `constants/Colors.ts`

**Step 1: 在 global.css 中定义设计 Token**

在 `global.css` 尾部追加 `@theme` 块：

```css
@theme {
  /* === "The Ethereal Steep" 设计系统 === */

  /* 主色调 - 茶叶深绿 */
  --color-primary: #435c3c;
  --color-primary-container: #5b7553;
  --color-on-primary: #ffffff;
  --color-on-primary-container: #ddfad0;
  --color-primary-fixed: #cdebc1;
  --color-primary-fixed-dim: #b2cfa7;

  /* 辅助色 - 大地棕 */
  --color-secondary: #715b3e;
  --color-secondary-container: #f9dbb7;
  --color-on-secondary: #ffffff;
  --color-on-secondary-container: #755f42;
  --color-secondary-fixed: #fcdeba;
  --color-secondary-fixed-dim: #dfc29f;

  /* 强调色 - 学士金 */
  --color-tertiary: #6c521d;
  --color-tertiary-container: #876a33;
  --color-on-tertiary: #ffffff;
  --color-on-tertiary-container: #fff0dd;
  --color-tertiary-fixed: #ffdea7;
  --color-tertiary-fixed-dim: #e6c181;

  /* 错误色 */
  --color-error: #ba1a1a;
  --color-error-container: #ffdad6;
  --color-on-error: #ffffff;
  --color-on-error-container: #93000a;

  /* 表面层级 - 温暖奶油色体系 */
  --color-background: #fef9f1;
  --color-on-background: #1d1c17;
  --color-surface: #fef9f1;
  --color-on-surface: #1d1c17;
  --color-surface-variant: #e7e2da;
  --color-on-surface-variant: #434840;
  --color-surface-dim: #ded9d2;
  --color-surface-bright: #fef9f1;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f8f3eb;
  --color-surface-container: #f2ede5;
  --color-surface-container-high: #ece8e0;
  --color-surface-container-highest: #e7e2da;

  /* 边框 & 反转 */
  --color-outline: #74796f;
  --color-outline-variant: #c3c8bd;
  --color-inverse-surface: #32302b;
  --color-inverse-on-surface: #f5f0e8;
  --color-inverse-primary: #b2cfa7;
  --color-surface-tint: #4c6544;

  /* 字体 */
  --font-headline: "Noto Serif SC", serif;
  --font-body: "Manrope", sans-serif;
  --font-label: "Manrope", sans-serif;
}
```

**Step 2: 创建 Colors 常量文件（供非样式代码使用）**

创建 `constants/Colors.ts`：

```typescript
/**
 * "The Ethereal Steep" 设计系统 - 颜色 Token
 * 用于 TabBar、StatusBar 等需要 JS 值的场景
 * 样式中优先使用 Tailwind className
 */
export const Colors = {
  primary: "#435c3c",
  primaryContainer: "#5b7553",
  onPrimary: "#ffffff",

  secondary: "#715b3e",
  secondaryContainer: "#f9dbb7",
  onSecondary: "#ffffff",

  tertiary: "#6c521d",
  tertiaryContainer: "#876a33",

  background: "#fef9f1",
  onBackground: "#1d1c17",
  surface: "#fef9f1",
  onSurface: "#1d1c17",
  surfaceContainerLow: "#f8f3eb",
  surfaceContainer: "#f2ede5",

  outline: "#74796f",
  outlineVariant: "#c3c8bd",
} as const;
```

**Step 3: 提交**

```bash
git add global.css constants/Colors.ts
git commit -m "feat: 建立 Ethereal Steep 设计系统 Token"
```

---

## Task 4: 安装字体 + 图标

**Files:**
- Modify: `app/_layout.tsx` (加载字体)

**Step 1: 安装字体包**

```bash
cd E:/liji-tea-app

# 安装 Google Fonts
npx expo install @expo-google-fonts/noto-serif-sc @expo-google-fonts/manrope

# 安装图标库（Expo 默认已包含 @expo/vector-icons）
npx expo install expo-font expo-splash-screen
```

**Step 2: 在根布局中加载字体**

修改 `app/_layout.tsx`：

```typescript
import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  NotoSerifSC_400Regular,
  NotoSerifSC_700Bold,
} from "@expo-google-fonts/noto-serif-sc";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";

// 防止启动屏在字体加载前消失
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoSerifSC_400Regular,
    NotoSerifSC_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
```

**Step 3: 提交**

```bash
git add app/_layout.tsx package.json package-lock.json
git commit -m "feat: 集成 Noto Serif SC + Manrope 字体"
```

---

## Task 5: 搭建底部 Tab 导航

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx` (首页)
- Create: `app/(tabs)/shop.tsx` (商城 - 占位)
- Create: `app/(tabs)/culture.tsx` (茶道 - 占位)
- Create: `app/(tabs)/community.tsx` (社区 - 占位)
- Create: `app/(tabs)/profile.tsx` (我的 - 占位)

**Step 1: 创建 Tab 布局**

创建 `app/(tabs)/_layout.tsx`：

```typescript
import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primaryContainer,
        tabBarInactiveTintColor: Colors.outline,
        tabBarStyle: {
          backgroundColor: "rgba(254, 249, 241, 0.85)",
          borderTopWidth: 0,
          elevation: 0,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontFamily: "Manrope_500Medium",
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="home"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "商城",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="shopping-bag"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="culture"
        options={{
          title: "茶道",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="menu-book"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "茶友",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="group"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "我的",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="person"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

**Step 2: 创建各 Tab 页面（占位）**

创建 `app/(tabs)/index.tsx`：

```typescript
import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="font-headline text-2xl text-primary">首页</Text>
    </View>
  );
}
```

创建 `app/(tabs)/shop.tsx`：

```typescript
import { Text, View } from "react-native";

export default function ShopScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="font-headline text-2xl text-on-surface">商城</Text>
    </View>
  );
}
```

创建 `app/(tabs)/culture.tsx`：

```typescript
import { Text, View } from "react-native";

export default function CultureScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="font-headline text-2xl text-on-surface">茶道</Text>
    </View>
  );
}
```

创建 `app/(tabs)/community.tsx`：

```typescript
import { Text, View } from "react-native";

export default function CommunityScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="font-headline text-2xl text-on-surface">茶友</Text>
    </View>
  );
}
```

创建 `app/(tabs)/profile.tsx`：

```typescript
import { Text, View } from "react-native";

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="font-headline text-2xl text-on-surface">我的</Text>
    </View>
  );
}
```

**Step 3: 验证 Tab 导航**

运行 `npx expo start --clear`，确认：
- 底部 5 个 Tab 都能点击切换
- 图标和标签显示正确
- 激活态颜色为 `#5b7553`（茶绿色）
- 背景为半透明奶油色

**Step 4: 提交**

```bash
git add app/
git commit -m "feat: 搭建 5 Tab 底部导航（首页/商城/茶道/茶友/我的）"
```

---

## Task 6: 首页顶部导航栏

**Files:**
- Create: `components/home/TopAppBar.tsx`
- Modify: `app/(tabs)/index.tsx`

**Step 1: 创建顶部导航栏组件**

创建 `components/home/TopAppBar.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TopAppBar() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-background/70 backdrop-blur-xl px-6 pb-3"
    >
      <View className="flex-row justify-between items-center h-14">
        {/* 左侧 - Logo */}
        <View className="flex-row items-center gap-3">
          <MaterialIcons name="menu" size={24} color="#435c3c" />
          <Text className="font-headline text-2xl tracking-widest font-bold text-primary">
            李记茶
          </Text>
        </View>

        {/* 右侧 - 功能图标 */}
        <View className="flex-row items-center gap-4">
          <Pressable hitSlop={8}>
            <MaterialIcons name="search" size={24} color="#435c3c" />
          </Pressable>
          <Pressable hitSlop={8}>
            <MaterialIcons name="notifications-none" size={24} color="#435c3c" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
```

**Step 2: 在首页中使用**

修改 `app/(tabs)/index.tsx`：

```typescript
import { ScrollView, View } from "react-native";
import TopAppBar from "@/components/home/TopAppBar";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-background">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 gap-8"
        showsVerticalScrollIndicator={false}
      >
        {/* 后续 Task 会逐步填入各区块 */}
      </ScrollView>
    </View>
  );
}
```

**Step 3: 提交**

```bash
git add components/home/TopAppBar.tsx app/(tabs)/index.tsx
git commit -m "feat: 首页顶部导航栏（Logo + 搜索 + 通知）"
```

---

## Task 7: Hero Banner 组件

**Files:**
- Create: `components/home/HeroBanner.tsx`
- Modify: `app/(tabs)/index.tsx`

**Step 1: 创建 Hero Banner**

创建 `components/home/HeroBanner.tsx`：

```typescript
import { View, Text, Pressable, ImageBackground } from "react-native";
import { Image } from "expo-image";

export default function HeroBanner() {
  return (
    <View className="w-full h-[200px] rounded-xl overflow-hidden">
      <Image
        source={require("@/assets/images/hero-banner.jpg")}
        className="absolute inset-0 w-full h-full"
        contentFit="cover"
        placeholder={{ blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH" }}
        transition={300}
      />
      {/* 渐变遮罩 */}
      <View className="absolute inset-0 bg-black/40" />

      {/* 文字内容 */}
      <View className="absolute inset-0 flex justify-center px-8 gap-2">
        <Text className="font-headline text-3xl text-surface-bright tracking-widest">
          一叶知春
        </Text>
        <Text className="text-surface-bright/90 text-sm font-light tracking-wide">
          新春明前龙井 · 限量发售
        </Text>
        <View className="pt-3">
          <Pressable className="bg-primary-container self-start px-6 py-2.5 rounded-full active:bg-primary">
            <Text className="text-surface-bright text-sm font-medium">
              立即探索
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
```

> **注意：** 需要准备一张 hero 图片放在 `assets/images/hero-banner.jpg`。开发阶段可以先用本地占位图，后续替换为真实图片。如果暂时没有图片，可以用网络图片 URL 作为 `source`。

**Step 2: 在首页 ScrollView 中添加**

修改 `app/(tabs)/index.tsx`，在 ScrollView 内添加：

```typescript
import HeroBanner from "@/components/home/HeroBanner";

// ... 在 ScrollView 内:
<HeroBanner />
```

**Step 3: 提交**

```bash
git add components/home/HeroBanner.tsx app/(tabs)/index.tsx assets/
git commit -m "feat: 首页 Hero Banner 组件（一叶知春）"
```

---

## Task 8: 茶类分类横滑组件

**Files:**
- Create: `components/home/CategoryRow.tsx`
- Modify: `app/(tabs)/index.tsx`

**Step 1: 创建分类行组件**

创建 `components/home/CategoryRow.tsx`：

```typescript
import { View, Text, ScrollView, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

/** 茶类分类数据 */
const CATEGORIES = [
  { label: "岩茶", icon: "energy-savings-leaf" as const, active: true },
  { label: "绿茶", icon: "eco" as const },
  { label: "白茶", icon: "spa" as const },
  { label: "红茶", icon: "coffee" as const },
  { label: "乌龙", icon: "grass" as const },
  { label: "普洱", icon: "local-cafe" as const },
  { label: "花茶", icon: "local-florist" as const },
] as const;

export default function CategoryRow() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-6 px-1"
    >
      {CATEGORIES.map((cat) => (
        <Pressable
          key={cat.label}
          className="items-center gap-2"
        >
          <View
            className={`w-14 h-14 rounded-full items-center justify-center ${
              cat.active
                ? "bg-surface-container-high border-2 border-primary-container"
                : "bg-surface-container-high"
            }`}
          >
            <MaterialIcons
              name={cat.icon}
              size={24}
              color={cat.active ? "#435c3c" : "#715b3e"}
            />
          </View>
          <Text className="text-xs font-medium text-on-surface">
            {cat.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

**Step 2: 在首页中添加**

在 `app/(tabs)/index.tsx` 的 ScrollView 内，HeroBanner 下方添加：

```typescript
import CategoryRow from "@/components/home/CategoryRow";

// ... ScrollView 内:
<HeroBanner />
<CategoryRow />
```

**Step 3: 提交**

```bash
git add components/home/CategoryRow.tsx app/(tabs)/index.tsx
git commit -m "feat: 茶类分类横滑组件（7 个茶类图标）"
```

---

## Task 9: 产品卡片 + 推荐产品组件

**Files:**
- Create: `components/product/ProductCard.tsx`
- Create: `components/home/FeaturedProducts.tsx`
- Create: `data/products.ts`
- Modify: `app/(tabs)/index.tsx`

**Step 1: 定义产品数据类型和模拟数据**

创建 `data/products.ts`：

```typescript
export interface Product {
  id: string;
  name: string;
  origin: string;
  price: number;
  image: string;
  description?: string;
  isNew?: boolean;
}

/** 本季推荐 */
export const featuredProducts: Product[] = [
  {
    id: "1",
    name: "西湖龙井 A级",
    origin: "杭州 西湖",
    price: 588,
    image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400",
  },
  {
    id: "2",
    name: "大红袍 特级",
    origin: "福建 武夷山",
    price: 1280,
    image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=400",
  },
  {
    id: "3",
    name: "安吉白茶",
    origin: "浙江 安吉",
    price: 420,
    image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400",
  },
];

/** 新品上市 */
export const newArrivals: Product[] = [
  {
    id: "4",
    name: "白毫银针 · 2024春",
    origin: "福建 福鼎",
    price: 899,
    description: "满披白毫，如银似雪，毫香幽显。",
    isNew: true,
    image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400",
  },
  {
    id: "5",
    name: "金骏眉 · 桐木关",
    origin: "福建 武夷山",
    price: 1580,
    description: "顶级红茶，花果蜜香，汤色金黄。",
    isNew: true,
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
  },
];
```

**Step 2: 创建产品卡片组件（横向小卡片）**

创建 `components/product/ProductCard.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import type { Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
}

export default function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="w-[160px] bg-surface-container-low rounded-lg overflow-hidden active:opacity-80"
    >
      {/* 产品图片 */}
      <View className="h-40 overflow-hidden">
        <Image
          source={{ uri: product.image }}
          className="w-full h-full"
          contentFit="cover"
          transition={200}
        />
      </View>

      {/* 产品信息 */}
      <View className="p-3 gap-1">
        <Text
          className="font-headline text-on-surface text-base"
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <Text className="text-[10px] text-outline">
          产地：{product.origin}
        </Text>
        <Text className="text-primary font-bold">¥{product.price}</Text>
      </View>
    </Pressable>
  );
}
```

**Step 3: 创建"本季推荐"区块**

创建 `components/home/FeaturedProducts.tsx`：

```typescript
import { View, Text, ScrollView, Pressable } from "react-native";
import ProductCard from "@/components/product/ProductCard";
import { featuredProducts } from "@/data/products";

export default function FeaturedProducts() {
  return (
    <View className="gap-4">
      {/* 标题行 */}
      <View className="flex-row justify-between items-end">
        <Text className="font-headline text-xl text-on-surface">本季推荐</Text>
        <Pressable>
          <Text className="text-tertiary text-sm font-medium">
            查看全部 &gt;
          </Text>
        </Pressable>
      </View>

      {/* 横向滚动产品列表 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-4"
      >
        {featuredProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ScrollView>
    </View>
  );
}
```

**Step 4: 在首页中添加**

```typescript
import FeaturedProducts from "@/components/home/FeaturedProducts";

// ... ScrollView 内:
<HeroBanner />
<CategoryRow />
<FeaturedProducts />
```

**Step 5: 提交**

```bash
git add data/products.ts components/product/ProductCard.tsx components/home/FeaturedProducts.tsx app/(tabs)/index.tsx
git commit -m "feat: 产品卡片 + 本季推荐横滑列表"
```

---

## Task 10: 茶文化 Banner + 新品上市 + 季节故事

**Files:**
- Create: `components/home/CultureBanner.tsx`
- Create: `components/home/NewArrivals.tsx`
- Create: `components/home/SeasonalStory.tsx`
- Modify: `app/(tabs)/index.tsx`

**Step 1: 创建茶文化入口 Banner**

创建 `components/home/CultureBanner.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function CultureBanner() {
  return (
    <Pressable className="w-full h-32 rounded-xl overflow-hidden active:opacity-90">
      {/* 暗色背景 + 水墨画 */}
      <View className="absolute inset-0 bg-[#2C2C2C]">
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800",
          }}
          className="w-full h-full opacity-50"
          contentFit="cover"
        />
      </View>

      {/* 文字叠层 */}
      <View className="absolute inset-0 flex justify-center px-8">
        <Text className="font-headline text-2xl text-surface-bright tracking-[8px]">
          茶之道
        </Text>
        <Text className="text-surface-bright/80 text-xs mt-1">
          探索千年茶文化
        </Text>
      </View>

      {/* 右侧图标 */}
      <View className="absolute right-6 top-1/2 -translate-y-1/2">
        <MaterialIcons name="auto-stories" size={36} color="rgba(254,249,241,0.4)" />
      </View>
    </Pressable>
  );
}
```

**Step 2: 创建"新品上市"网格组件**

创建 `components/home/NewArrivals.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { newArrivals } from "@/data/products";

export default function NewArrivals() {
  return (
    <View className="gap-4">
      <Text className="font-headline text-xl text-on-surface">新品上市</Text>

      <View className="flex-row gap-4">
        {newArrivals.map((product) => (
          <Pressable
            key={product.id}
            className="flex-1 bg-surface-container-low rounded-xl overflow-hidden active:opacity-80"
          >
            {/* 正方形图片 */}
            <View className="aspect-square overflow-hidden">
              <Image
                source={{ uri: product.image }}
                className="w-full h-full"
                contentFit="cover"
                transition={200}
              />
            </View>

            {/* 产品信息 */}
            <View className="p-4 gap-2">
              <Text className="font-headline text-on-surface text-sm">
                {product.name}
              </Text>
              <Text className="text-[10px] text-outline leading-relaxed">
                {product.description}
              </Text>
              <View className="flex-row justify-between items-center pt-2">
                <Text className="text-primary font-bold">¥{product.price}</Text>
                <Pressable hitSlop={8}>
                  <MaterialIcons
                    name="add-circle"
                    size={22}
                    color="#5b7553"
                  />
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

**Step 3: 创建"春茶物语"季节故事区块**

创建 `components/home/SeasonalStory.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";

export default function SeasonalStory() {
  return (
    <View className="w-full aspect-[16/9] rounded-xl overflow-hidden">
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=800",
        }}
        className="absolute inset-0 w-full h-full"
        contentFit="cover"
        transition={300}
      />

      {/* 遮罩 + 内容 */}
      <View className="absolute inset-0 bg-black/30 items-center justify-center p-6 gap-3">
        <Text className="font-headline text-2xl text-surface-bright tracking-[6px]">
          春茶物语
        </Text>
        <View className="w-12 h-px bg-surface-bright/50" />
        <Text className="text-surface-bright/90 text-sm italic font-light text-center">
          "将这一抹春色，收纳在方寸壶中。"
        </Text>
        <Pressable className="mt-3 border border-surface-bright/50 px-5 py-1.5 rounded-full active:bg-surface-bright/20">
          <Text className="text-surface-bright text-xs">阅读全文</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

**Step 4: 组装完整首页**

最终的 `app/(tabs)/index.tsx`：

```typescript
import { ScrollView, View } from "react-native";
import TopAppBar from "@/components/home/TopAppBar";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryRow from "@/components/home/CategoryRow";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import CultureBanner from "@/components/home/CultureBanner";
import NewArrivals from "@/components/home/NewArrivals";
import SeasonalStory from "@/components/home/SeasonalStory";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-background">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 gap-8"
        showsVerticalScrollIndicator={false}
      >
        <HeroBanner />
        <CategoryRow />
        <FeaturedProducts />
        <CultureBanner />
        <NewArrivals />
        <SeasonalStory />
      </ScrollView>
    </View>
  );
}
```

**Step 5: 验证完整首页**

运行 `npx expo start --clear`，确认：
- 顶部 "李记茶" Logo + 搜索/通知图标
- Hero Banner 显示 "一叶知春" + CTA 按钮
- 7 个茶类圆形图标横向可滑动
- "本季推荐" 3 张产品卡片横向滚动
- "茶之道" 深色文化入口 Banner
- "新品上市" 2 列网格布局
- "春茶物语" 全宽图文卡片
- 底部 5 Tab 导航功能正常

**Step 6: 提交**

```bash
git add components/home/ app/(tabs)/index.tsx
git commit -m "feat: 完成首页全部区块（Banner/分类/推荐/文化/新品/故事）"
```

---

## Task 11: expo-image 安装 + 图片资源准备

**Files:**
- Modify: `package.json`

**Step 1: 确保 expo-image 已安装**

```bash
npx expo install expo-image
```

> 注意：此依赖在 Task 7-10 的代码中已被使用。如果在 Task 2 之后就执行此步骤会更好，但为了保持计划的线性结构，这里作为独立确认步骤。

**Step 2: 准备占位图片**

在开发阶段，产品图片使用 Unsplash 的网络 URL。正式发布前需要：
1. 将产品图片下载到 `assets/images/products/` 目录
2. 准备 Hero Banner 图片 `assets/images/hero-banner.jpg`
3. 更新代码中的 `source` 为本地引用

**Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: 确认 expo-image 依赖"
```

---

## Task 12: 最终检查 + Sprint 1 总结提交

**Step 1: 全局类型检查**

```bash
cd E:/liji-tea-app
npx tsc --noEmit
```

修复所有 TypeScript 错误。

**Step 2: 运行项目并截图验证**

```bash
npx expo start --clear
```

确认所有功能正常后进行最终提交。

**Step 3: 最终提交**

```bash
git add -A
git commit -m "chore: Sprint 1 完成 — 项目框架 + 设计系统 + Tab导航 + 首页"
```

---

## Sprint 1 交付清单

| 交付物 | 状态 |
|--------|------|
| Expo SDK 55 项目初始化 | ✅ |
| NativeWind v5 + Tailwind CSS v4 | ✅ |
| "The Ethereal Steep" 设计 Token | ✅ |
| Noto Serif SC + Manrope 字体 | ✅ |
| 底部 5 Tab 导航 | ✅ |
| 首页 - TopAppBar | ✅ |
| 首页 - Hero Banner | ✅ |
| 首页 - 茶类分类行 | ✅ |
| 首页 - 本季推荐（横向产品卡片） | ✅ |
| 首页 - 茶文化入口 Banner | ✅ |
| 首页 - 新品上市（2列网格） | ✅ |
| 首页 - 春茶物语 | ✅ |
| 产品数据模型 + 模拟数据 | ✅ |
| 可复用 ProductCard 组件 | ✅ |
