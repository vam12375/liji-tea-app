# Sprint 5: 高级功能 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 AR 识茶（模拟 UI）、礼品卡/送礼、物流追踪三个独立页面，完成全部 13 页面。

**Architecture:** 三个页面均为独立路由。AR 识茶使用静态模拟 UI（无真实相机）。礼品卡使用横向 FlatList snap carousel。物流追踪使用自定义 Timeline 组件。

**Tech Stack:** 基于 Sprint 4，无新增依赖

---

## Task 1: AR 识茶页面

**Files:**
- Create: `src/app/ar-scan.tsx`

创建 `src/app/ar-scan.tsx`：

```typescript
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

export default function ARScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [identified, setIdentified] = useState(false);

  return (
    <View className="flex-1 bg-on-surface">
      <Stack.Screen options={{ headerShown: false }} />

      {/* 模拟相机背景 */}
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800" }}
        className="absolute inset-0 w-full h-full opacity-60"
        contentFit="cover"
      />

      {/* 顶部导航 */}
      <View style={{ paddingTop: insets.top }} className="absolute top-0 left-0 right-0 z-50 px-4">
        <View className="flex-row justify-between items-center h-14">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center">
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Text className="text-surface-bright font-medium text-base">AR 识茶</Text>
          <Pressable className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center">
            <MaterialIcons name="flash-on" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* 扫描框 */}
      <View className="flex-1 items-center justify-center">
        <View className="w-60 h-60 relative">
          {/* 四个角的金色边框 */}
          <View className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-tertiary-fixed rounded-tl-lg" />
          <View className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-tertiary-fixed rounded-tr-lg" />
          <View className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-tertiary-fixed rounded-bl-lg" />
          <View className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-tertiary-fixed rounded-br-lg" />
        </View>
        <Text className="text-surface-bright/60 text-xs mt-4">将茶叶对准框内</Text>
      </View>

      {/* 底部工具栏 */}
      <View style={{ paddingBottom: insets.bottom || 24 }} className="absolute bottom-0 left-0 right-0 z-50 px-8 pb-4">
        {/* 操作按钮 */}
        <View className="flex-row justify-between items-center mb-6">
          <Pressable className="w-12 h-12 rounded-full bg-surface/20 items-center justify-center">
            <MaterialIcons name="photo-library" size={24} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => setIdentified(true)}
            className="w-20 h-20 rounded-full border-4 border-tertiary-fixed items-center justify-center active:scale-95"
          >
            <View className="w-16 h-16 rounded-full bg-surface-bright" />
          </Pressable>
          <Pressable className="w-12 h-12 rounded-full bg-surface/20 items-center justify-center">
            <MaterialIcons name="history" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* 识别结果底部弹出 */}
        {identified && (
          <Pressable
            onPress={() => router.back()}
            className="bg-surface/90 rounded-t-[32px] rounded-b-2xl p-6 gap-3"
          >
            <View className="w-10 h-1 bg-outline-variant/40 rounded-full self-center" />
            <View className="flex-row items-center justify-between">
              <View className="gap-1">
                <Text className="font-headline text-on-surface text-lg font-bold">特级西湖龙井</Text>
                <View className="flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full bg-primary" />
                  <Text className="text-primary text-xs font-medium">匹配度 96%</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Colors.outline} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}
```

提交：`git commit -m "feat: AR 识茶页面（模拟扫描 UI + 识别结果）"`

---

## Task 2: 礼品卡/送礼页面

**Files:**
- Create: `src/data/gifts.ts`
- Create: `src/app/gift.tsx`

创建 `src/data/gifts.ts`：

```typescript
export interface GiftCard {
  id: string;
  title: string;
  subtitle: string;
  image: string;
}

export interface GiftSet {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
}

export const giftCards: GiftCard[] = [
  { id: "g1", title: "感恩有你", subtitle: "以茶传情", image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=600" },
  { id: "g2", title: "生日快乐", subtitle: "岁月如茶", image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600" },
  { id: "g3", title: "新年吉祥", subtitle: "茶韵贺岁", image: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=600" },
  { id: "g4", title: "思念远方", subtitle: "一盏相思", image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=600" },
];

export const giftSets: GiftSet[] = [
  { id: "gs1", name: "入门品鉴套装", description: "精选3款经典茶品·含冲泡指南", price: 168, image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=200" },
  { id: "gs2", name: "匠心典藏礼盒", description: "6款名茶·紫砂壶·竹制茶盘", price: 398, image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=200" },
  { id: "gs3", name: "至臻年份珍藏", description: "10年陈普洱·手工建盏·锡罐", price: 888, image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=200" },
];

export const messageTags = ["感谢", "生日快乐", "新年吉祥", "思念"];
```

创建 `src/app/gift.tsx`：

```typescript
import { useState, useRef } from "react";
import { View, Text, TextInput, Pressable, FlatList, Switch, Dimensions } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { giftCards, giftSets, messageTags } from "@/data/gifts";

const CARD_WIDTH = Dimensions.get("window").width - 64;

export default function GiftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedCard, setSelectedCard] = useState(giftCards[0].id);
  const [selectedSet, setSelectedSet] = useState(giftSets[1].id);
  const [message, setMessage] = useState("");
  const [wechat, setWechat] = useState(false);

  const selectedPrice = giftSets.find((s) => s.id === selectedSet)?.price ?? 0;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "以茶为礼",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={[1]}
        renderItem={() => (
          <View className="gap-8 px-4 pb-32">
            {/* 礼品卡选择 - 横向滚动 */}
            <View className="gap-3">
              <Text className="font-headline text-on-surface text-base font-bold">选择贺卡</Text>
              <FlatList
                data={giftCards}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 12}
                decelerationRate="fast"
                contentContainerStyle={{ gap: 12 }}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setSelectedCard(item.id)}
                    className={`rounded-2xl overflow-hidden ${selectedCard === item.id ? "ring-2 ring-primary/20" : ""}`}
                    style={{ width: CARD_WIDTH }}
                  >
                    <View className="aspect-video relative">
                      <Image source={{ uri: item.image }} className="w-full h-full" contentFit="cover" />
                      <View className="absolute inset-0 bg-black/40" />
                      <View className="absolute bottom-4 left-5 gap-0.5">
                        <Text className="font-headline text-surface-bright text-xl font-bold">{item.title}</Text>
                        <Text className="text-surface-bright/70 text-xs">{item.subtitle}</Text>
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            </View>

            {/* 祝福语 */}
            <View className="gap-3">
              <Text className="font-headline text-on-surface text-base font-bold">祝福语</Text>
              <TextInput
                value={message}
                onChangeText={(t) => setMessage(t.slice(0, 100))}
                placeholder="写下你的祝福..."
                placeholderTextColor={Colors.outline}
                className="bg-surface-container-low rounded-xl p-4 text-on-surface text-sm min-h-[100px]"
                multiline
                textAlignVertical="top"
              />
              <View className="flex-row justify-between items-center">
                <View className="flex-row gap-2">
                  {messageTags.map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() => setMessage(tag)}
                      className="bg-surface-container-high px-3 py-1 rounded-full"
                    >
                      <Text className="text-on-surface-variant text-xs">{tag}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-outline text-xs">{message.length}/100</Text>
              </View>
            </View>

            {/* 茶礼套装 */}
            <View className="gap-3">
              <Text className="font-headline text-on-surface text-base font-bold">选择茶礼</Text>
              {giftSets.map((set) => (
                <Pressable
                  key={set.id}
                  onPress={() => setSelectedSet(set.id)}
                  className={`flex-row items-center gap-3 p-3 rounded-xl ${
                    selectedSet === set.id ? "bg-primary-container/10 border border-primary/10" : "bg-surface-container-low"
                  }`}
                >
                  <Image source={{ uri: set.image }} className="w-24 h-24 rounded-lg" contentFit="cover" />
                  <View className="flex-1 gap-1">
                    <Text className="font-headline text-on-surface text-sm font-bold">{set.name}</Text>
                    <Text className="text-on-surface-variant text-xs">{set.description}</Text>
                    <Text className="text-tertiary font-bold mt-1">¥{set.price}</Text>
                  </View>
                  <MaterialIcons
                    name={selectedSet === set.id ? "check-circle" : "radio-button-unchecked"}
                    size={22}
                    color={selectedSet === set.id ? Colors.primaryContainer : Colors.outlineVariant}
                  />
                </Pressable>
              ))}
            </View>

            {/* 收礼人信息 */}
            <View className="gap-3">
              <Text className="font-headline text-on-surface text-base font-bold">收礼人</Text>
              <TextInput
                placeholder="姓名"
                placeholderTextColor={Colors.outline}
                className="bg-surface-container-low rounded-xl px-4 py-3 text-on-surface text-sm"
              />
              <TextInput
                placeholder="手机号"
                placeholderTextColor={Colors.outline}
                keyboardType="phone-pad"
                className="bg-surface-container-low rounded-xl px-4 py-3 text-on-surface text-sm"
              />
              <View className="flex-row items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="chat" size={18} color={Colors.primaryContainer} />
                  <Text className="text-on-surface text-sm">通过微信发送</Text>
                </View>
                <Switch
                  value={wechat}
                  onValueChange={setWechat}
                  trackColor={{ true: Colors.primaryContainer, false: Colors.outlineVariant }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        )}
        keyExtractor={() => "gift-content"}
        showsVerticalScrollIndicator={false}
      />

      {/* 底部操作栏 */}
      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3"
      >
        <Pressable className="bg-primary-container rounded-full py-4 flex-row items-center justify-center gap-3 active:bg-primary">
          <Text className="text-on-primary font-headline text-lg font-bold">¥{selectedPrice}</Text>
          <Text className="text-on-primary font-medium">赠送茶礼</Text>
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
```

提交：`git commit -m "feat: 礼品卡页面（贺卡选择/祝福语/茶礼套装/收礼人）"`

---

## Task 3: 物流追踪页面

**Files:**
- Create: `src/app/tracking.tsx`

创建 `src/app/tracking.tsx`：

```typescript
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

const TIMELINE = [
  { status: "已签收", detail: "已由本人签收，感谢使用顺丰速运", time: "2026-03-20 14:32", active: true },
  { status: "派送中", detail: "快递员张师傅正在派送中 (138****6789)", time: "2026-03-20 09:15" },
  { status: "运输中", detail: "快件到达【上海静安营业部】", time: "2026-03-19 22:40" },
  { status: "已发货", detail: "卖家已发货，顺丰快递揽收", time: "2026-03-18 16:20" },
];

export default function TrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "物流追踪",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1" contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
        {/* 地图区域（模拟） */}
        <View className="mx-4 h-48 rounded-2xl overflow-hidden bg-surface-container-high relative">
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800" }}
            className="w-full h-full opacity-40"
            contentFit="cover"
          />
          <View className="absolute inset-0 items-center justify-center">
            <MaterialIcons name="local-shipping" size={36} color={Colors.primaryContainer} />
          </View>
          {/* 起点/终点 */}
          <View className="absolute bottom-3 left-4 flex-row items-center gap-1">
            <View className="w-2 h-2 rounded-full bg-primary" />
            <Text className="text-on-surface text-[10px]">福建武夷山</Text>
          </View>
          <View className="absolute bottom-3 right-4 flex-row items-center gap-1">
            <Text className="text-on-surface text-[10px]">上海静安</Text>
            <View className="w-2 h-2 rounded-full bg-tertiary" />
          </View>
        </View>

        {/* 快递信息 */}
        <View className="mx-4 mt-4 bg-surface-container-low rounded-xl p-4 flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-on-surface font-bold text-sm">顺丰速运</Text>
            <Text className="text-outline text-xs">SF1234567890</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable className="px-3 py-1.5 rounded-full border border-outline-variant">
              <Text className="text-on-surface text-xs">复制</Text>
            </Pressable>
            <Pressable className="w-9 h-9 rounded-full bg-primary-container items-center justify-center">
              <MaterialIcons name="phone" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* 物流时间线 */}
        <View className="mx-4 mt-6 gap-0 relative">
          {/* 垂直连接线 */}
          <View className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-surface-variant" />

          {TIMELINE.map((item, index) => (
            <View key={index} className="flex-row gap-4 pb-6">
              {/* 圆点 */}
              <View className="items-center w-6 pt-1">
                {item.active ? (
                  <View className="w-6 h-6 rounded-full bg-primary-container items-center justify-center z-10">
                    <MaterialIcons name="check" size={14} color="#fff" />
                  </View>
                ) : (
                  <View className="w-3 h-3 rounded-full bg-outline-variant z-10" />
                )}
              </View>
              {/* 内容 */}
              <View className="flex-1 gap-1">
                <Text className={`text-sm font-medium ${item.active ? "text-on-surface" : "text-outline"}`}>
                  {item.status}
                </Text>
                <Text className="text-on-surface-variant text-xs">{item.detail}</Text>
                <Text className="text-outline text-[10px] mt-0.5">{item.time}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 包裹概要 */}
        <View className="mx-4 mt-2 bg-surface-container-low rounded-xl p-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="flex-row -space-x-3">
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=100" }}
                className="w-10 h-10 rounded-full border-2 border-surface-container-low"
                contentFit="cover"
              />
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=100" }}
                className="w-10 h-10 rounded-full border-2 border-surface-container-low"
                contentFit="cover"
              />
            </View>
            <View className="gap-0.5">
              <Text className="text-on-surface text-sm font-medium">特级龙井 & 熟普洱套装</Text>
              <Text className="text-outline text-xs">共2件商品</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
        </View>
      </ScrollView>
    </View>
  );
}
```

提交：`git commit -m "feat: 物流追踪页面（地图/快递信息/时间线/包裹概要）"`

---

## Task 4: 验证

```bash
npx tsc --noEmit
```

---

## Sprint 5 交付清单

| 交付物 | 状态 |
|--------|------|
| AR 识茶（模拟扫描框 + 识别结果弹出） | ✅ |
| 礼品卡（贺卡轮播 + 祝福语 + 茶礼套装 + 收礼人） | ✅ |
| 物流追踪（地图 + 快递信息 + 时间线 + 包裹概要） | ✅ |
