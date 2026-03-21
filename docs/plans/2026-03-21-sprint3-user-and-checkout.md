# Sprint 3: 用户体系 + 交易 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现结算页面（完成购物流程闭环）、个人中心页面（会员体系 UI）、收藏功能，以及模拟登录注册流程。

**Architecture:** 使用 Zustand 管理用户状态（登录态、收藏列表、地址）和订单状态。登录/注册为本地模拟（无后端），数据持久化到 AsyncStorage。结算页为独立路由 `/checkout`，个人中心替换 profile Tab 占位页。

**Tech Stack:** 基于 Sprint 2 + 无新增依赖

---

## Task 1: 用户状态管理 (Zustand Stores)

**Files:**
- Create: `src/stores/userStore.ts`
- Create: `src/stores/orderStore.ts`

**Step 1: 创建用户 Store**

创建 `src/stores/userStore.ts`：

```typescript
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

export interface UserState {
  isLoggedIn: boolean;
  name: string;
  phone: string;
  avatar: string;
  memberTier: string;
  points: number;
  favorites: string[]; // 产品 ID 列表
  addresses: Address[];

  login: (name: string, phone: string) => void;
  logout: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  addAddress: (address: Address) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  getDefaultAddress: () => Address | undefined;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      name: "",
      phone: "",
      avatar: "",
      memberTier: "金叶会员",
      points: 2680,
      favorites: [],
      addresses: [
        {
          id: "1",
          name: "王先生",
          phone: "138****8888",
          address: "上海市静安区南京西路1888号",
          isDefault: true,
        },
      ],

      login: (name, phone) =>
        set({ isLoggedIn: true, name, phone }),

      logout: () =>
        set({ isLoggedIn: false, name: "", phone: "" }),

      toggleFavorite: (productId) =>
        set((state) => ({
          favorites: state.favorites.includes(productId)
            ? state.favorites.filter((id) => id !== productId)
            : [...state.favorites, productId],
        })),

      isFavorite: (productId) => get().favorites.includes(productId),

      addAddress: (address) =>
        set((state) => ({
          addresses: address.isDefault
            ? [
                ...state.addresses.map((a) => ({ ...a, isDefault: false })),
                address,
              ]
            : [...state.addresses, address],
        })),

      removeAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.filter((a) => a.id !== id),
        })),

      setDefaultAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.map((a) => ({
            ...a,
            isDefault: a.id === id,
          })),
        })),

      getDefaultAddress: () => get().addresses.find((a) => a.isDefault),
    }),
    {
      name: "liji-user",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**Step 2: 提交**

```bash
git add src/stores/userStore.ts
git commit -m "feat: 用户状态管理（登录/收藏/地址 + 持久化）"
```

---

## Task 2: 收藏功能集成

**Files:**
- Modify: `src/components/shop/ShopProductCard.tsx`
- Modify: `src/app/product/[id].tsx`

**Step 1: 商城卡片收藏功能**

修改 `ShopProductCard.tsx`，添加收藏切换：
- 导入 `useUserStore`
- 收藏图标从 `favorite-border` 变为 `favorite`（已收藏时）
- 颜色从 `Colors.outline` 变为 `Colors.error`（已收藏时）
- 添加 `onPress` 调用 `toggleFavorite`

**Step 2: 详情页收藏功能**

修改 `product/[id].tsx`：
- Hero 上方收藏按钮切换 `favorite-border` / `favorite`
- 使用 `useUserStore` 的 `toggleFavorite` 和 `isFavorite`

**Step 3: 提交**

```bash
git add src/components/shop/ShopProductCard.tsx src/app/product/[id].tsx
git commit -m "feat: 收藏功能（商城卡片 + 详情页切换）"
```

---

## Task 3: 结算页面

**Files:**
- Create: `src/app/checkout.tsx`
- Create: `src/components/checkout/AddressCard.tsx`
- Create: `src/components/checkout/OrderItemCard.tsx`
- Create: `src/components/checkout/DeliveryOptions.tsx`
- Create: `src/components/checkout/PaymentMethods.tsx`
- Create: `src/components/checkout/PriceBreakdown.tsx`

**Step 1: 创建地址卡片组件**

创建 `src/components/checkout/AddressCard.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { Address } from "@/stores/userStore";

interface AddressCardProps {
  address: Address;
  onPress?: () => void;
}

export default function AddressCard({ address, onPress }: AddressCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-container-low rounded-xl p-4 flex-row items-center gap-3 active:opacity-80"
    >
      <MaterialIcons name="location-on" size={24} color={Colors.primaryContainer} />
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-headline text-on-surface text-base font-medium">
            {address.name}
          </Text>
          <Text className="text-outline text-sm">{address.phone}</Text>
          {address.isDefault && (
            <View className="bg-primary-container/20 px-2 py-0.5 rounded">
              <Text className="text-primary text-[10px]">默认</Text>
            </View>
          )}
        </View>
        <Text className="text-on-surface-variant text-sm" numberOfLines={2}>
          {address.address}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
    </Pressable>
  );
}
```

**Step 2: 创建订单商品项组件**

创建 `src/components/checkout/OrderItemCard.tsx`：

```typescript
import { View, Text } from "react-native";
import { Image } from "expo-image";
import type { CartItem } from "@/stores/cartStore";

interface OrderItemCardProps {
  item: CartItem;
}

export default function OrderItemCard({ item }: OrderItemCardProps) {
  const { product, quantity } = item;

  return (
    <View className="flex-row items-center gap-3 py-3">
      <Image
        source={{ uri: product.image }}
        className="w-[60px] h-[60px] rounded-lg"
        contentFit="cover"
      />
      <View className="flex-1 gap-1">
        <Text className="font-headline text-on-surface text-sm" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="text-outline text-xs">{product.unit}</Text>
      </View>
      <View className="items-end gap-1">
        <Text className="font-headline text-on-surface text-sm">
          ¥{product.price}
        </Text>
        <Text className="text-outline text-xs">x{quantity}</Text>
      </View>
    </View>
  );
}
```

**Step 3: 创建配送方式组件**

创建 `src/components/checkout/DeliveryOptions.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";

const OPTIONS = [
  { id: "standard", label: "标准配送 (3-5天)", price: 0 },
  { id: "express", label: "顺丰加急 (1-2天)", price: 15 },
] as const;

interface DeliveryOptionsProps {
  selected: string;
  onSelect: (id: string) => void;
}

export default function DeliveryOptions({ selected, onSelect }: DeliveryOptionsProps) {
  return (
    <View className="gap-3">
      <Text className="font-headline text-on-surface text-base">配送方式</Text>
      {OPTIONS.map((opt) => (
        <Pressable
          key={opt.id}
          onPress={() => onSelect(opt.id)}
          className="flex-row justify-between items-center py-2"
        >
          <View className="flex-row items-center gap-3">
            <View
              className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                selected === opt.id ? "border-primary-container" : "border-outline-variant"
              }`}
            >
              {selected === opt.id && (
                <View className="w-2.5 h-2.5 rounded-full bg-primary-container" />
              )}
            </View>
            <Text className="text-on-surface text-sm">{opt.label}</Text>
          </View>
          <Text className="text-outline text-sm">
            {opt.price === 0 ? "免费" : `¥${opt.price}`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
```

**Step 4: 创建支付方式组件**

创建 `src/components/checkout/PaymentMethods.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

const METHODS = [
  { id: "wechat", label: "微信支付", icon: "account-balance-wallet" as const, color: "#07C160" },
  { id: "alipay", label: "支付宝", icon: "payments" as const, color: "#1677FF" },
  { id: "card", label: "银行卡", icon: "credit-card" as const, color: Colors.secondaryContainer },
] as const;

interface PaymentMethodsProps {
  selected: string;
  onSelect: (id: string) => void;
}

export default function PaymentMethods({ selected, onSelect }: PaymentMethodsProps) {
  return (
    <View className="gap-3">
      <Text className="font-headline text-on-surface text-base">支付方式</Text>
      {METHODS.map((method) => (
        <Pressable
          key={method.id}
          onPress={() => onSelect(method.id)}
          className="flex-row items-center gap-3 py-2"
        >
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: method.color + "20" }}
          >
            <MaterialIcons name={method.icon} size={18} color={method.color} />
          </View>
          <Text className="flex-1 text-on-surface text-sm">{method.label}</Text>
          <View
            className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
              selected === method.id ? "border-primary-container" : "border-outline-variant"
            }`}
          >
            {selected === method.id && (
              <View className="w-2.5 h-2.5 rounded-full bg-primary-container" />
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
```

**Step 5: 创建价格明细组件**

创建 `src/components/checkout/PriceBreakdown.tsx`：

```typescript
import { View, Text } from "react-native";

interface PriceBreakdownProps {
  subtotal: number;
  shipping: number;
  discount: number;
  giftBox: boolean;
}

export default function PriceBreakdown({
  subtotal,
  shipping,
  discount,
  giftBox,
}: PriceBreakdownProps) {
  const giftBoxPrice = giftBox ? 28 : 0;
  const total = subtotal + shipping - discount + giftBoxPrice;

  return (
    <View className="gap-3">
      <Row label="商品小计" value={`¥${subtotal}`} />
      <Row label="运费" value={shipping === 0 ? "免费" : `¥${shipping}`} />
      {discount > 0 && (
        <Row label="优惠" value={`-¥${discount}`} valueClass="text-primary font-bold" />
      )}
      {giftBox && <Row label="礼盒包装" value={`+¥${giftBoxPrice}`} />}
      <View className="h-px bg-outline-variant/20 my-1" />
      <View className="flex-row justify-between items-center">
        <Text className="text-on-surface font-medium">合计</Text>
        <Text className="font-headline text-primary text-2xl font-bold">
          ¥{total}
        </Text>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  valueClass = "text-on-surface",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-outline text-sm">{label}</Text>
      <Text className={`text-sm ${valueClass}`}>{value}</Text>
    </View>
  );
}
```

**Step 6: 创建结算页面**

创建 `src/app/checkout.tsx`：

```typescript
import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Switch, Alert } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useCartStore } from "@/stores/cartStore";
import { useUserStore } from "@/stores/userStore";
import AddressCard from "@/components/checkout/AddressCard";
import OrderItemCard from "@/components/checkout/OrderItemCard";
import DeliveryOptions from "@/components/checkout/DeliveryOptions";
import PaymentMethods from "@/components/checkout/PaymentMethods";
import PriceBreakdown from "@/components/checkout/PriceBreakdown";

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, subtotal, clearCart } = useCartStore();
  const { getDefaultAddress } = useUserStore();

  const [delivery, setDelivery] = useState("standard");
  const [payment, setPayment] = useState("wechat");
  const [note, setNote] = useState("");
  const [giftBox, setGiftBox] = useState(false);

  const address = getDefaultAddress();
  const shippingCost = delivery === "express" ? 15 : 0;
  const discount = subtotal() >= 1000 ? 50 : 0;
  const giftBoxPrice = giftBox ? 28 : 0;
  const total = subtotal() + shippingCost - discount + giftBoxPrice;

  const handleSubmit = () => {
    Alert.alert("订单已提交", `订单金额: ¥${total}`, [
      {
        text: "确定",
        onPress: () => {
          clearCart();
          router.replace("/(tabs)");
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "确认订单",
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

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-4 gap-5 pb-32"
        showsVerticalScrollIndicator={false}
      >
        {/* 收货地址 */}
        {address && <AddressCard address={address} />}

        {/* 订单商品 */}
        <View className="bg-surface-container-lowest rounded-xl px-4">
          {items.map((item) => (
            <OrderItemCard key={item.product.id} item={item} />
          ))}
        </View>

        {/* 配送方式 */}
        <DeliveryOptions selected={delivery} onSelect={setDelivery} />

        {/* 支付方式 */}
        <PaymentMethods selected={payment} onSelect={setPayment} />

        {/* 订单备注 */}
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="备注: 请轻拿轻放..."
          placeholderTextColor={Colors.outline}
          className="bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface"
          multiline
        />

        {/* 礼盒包装 */}
        <View className="flex-row items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
          <View className="flex-row items-center gap-3">
            <MaterialIcons name="card-giftcard" size={20} color={Colors.tertiary} />
            <Text className="text-on-surface text-sm">
              精美礼盒包装{" "}
              <Text className="text-tertiary font-medium">+¥28</Text>
            </Text>
          </View>
          <Switch
            value={giftBox}
            onValueChange={setGiftBox}
            trackColor={{ true: Colors.primaryContainer, false: Colors.outlineVariant }}
            thumbColor="#fff"
          />
        </View>

        {/* 价格明细 */}
        <PriceBreakdown
          subtotal={subtotal()}
          shipping={shippingCost}
          discount={discount}
          giftBox={giftBox}
        />
      </ScrollView>

      {/* 底部提交栏 */}
      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3"
      >
        <Pressable
          onPress={handleSubmit}
          className="bg-primary-container rounded-full py-4 flex-row items-center justify-center gap-4 active:bg-primary"
        >
          <Text className="text-on-primary font-medium text-base">提交订单</Text>
          <Text className="text-on-primary font-headline text-lg font-bold">
            ¥{total}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

**Step 7: 连接购物车结算按钮**

修改 `src/app/cart.tsx`，将"去结算"按钮的 `onPress` 改为导航到 `/checkout`：
```typescript
onPress={() => router.push("/checkout")}
```

**Step 8: 提交**

```bash
git add src/app/checkout.tsx src/components/checkout/ src/app/cart.tsx
git commit -m "feat: 结算页面（地址/商品/配送/支付/礼盒/价格明细）"
```

---

## Task 4: 个人中心页面

**Files:**
- Modify: `src/app/(tabs)/profile.tsx`
- Create: `src/components/profile/MemberHeader.tsx`
- Create: `src/components/profile/StatsGrid.tsx`
- Create: `src/components/profile/OrderStatusRow.tsx`
- Create: `src/components/profile/MenuList.tsx`
- Create: `src/components/profile/MemberBenefitsCard.tsx`

**Step 1: 创建会员头部组件**

创建 `src/components/profile/MemberHeader.tsx`：

```typescript
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { useUserStore } from "@/stores/userStore";

export default function MemberHeader() {
  const { name, memberTier, points } = useUserStore();
  const displayName = name || "王先生";
  const progress = 89;

  return (
    <View className="bg-primary/5 px-6 pt-8 pb-6 gap-4">
      {/* 头像 + 信息 */}
      <View className="flex-row items-center gap-4">
        <View className="relative">
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200" }}
            className="w-20 h-20 rounded-full border-2 border-tertiary"
            contentFit="cover"
          />
          <View className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-tertiary items-center justify-center">
            <Text className="text-on-tertiary text-[8px]">🍃</Text>
          </View>
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-headline text-xl text-on-surface font-bold">
            {displayName}
          </Text>
          <View className="bg-tertiary self-start px-2.5 py-0.5 rounded-full">
            <Text className="text-on-tertiary text-xs font-bold">
              {memberTier}
            </Text>
          </View>
          <Text className="text-on-surface-variant text-xs mt-1">
            茶叶积分 {points.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* 等级进度条 */}
      <View className="gap-1.5">
        <View className="flex-row justify-between">
          <Text className="text-on-surface-variant text-[10px]">
            距离翡翠会员还需 320 积分
          </Text>
          <Text className="text-tertiary text-[10px] font-bold">{progress}%</Text>
        </View>
        <View className="h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
          <View
            className="h-full bg-tertiary rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>
    </View>
  );
}
```

**Step 2: 创建数据统计网格**

创建 `src/components/profile/StatsGrid.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";

const STATS = [
  { label: "收藏", value: 12 },
  { label: "足迹", value: 48 },
  { label: "关注", value: 6 },
  { label: "粉丝", value: 23 },
];

export default function StatsGrid() {
  return (
    <View className="flex-row px-4 py-3">
      {STATS.map((stat) => (
        <Pressable
          key={stat.label}
          className="flex-1 items-center gap-1 active:opacity-60"
        >
          <Text className="text-on-surface text-lg font-bold">{stat.value}</Text>
          <Text className="text-outline text-xs">{stat.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

**Step 3: 创建订单状态行**

创建 `src/components/profile/OrderStatusRow.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

const STATUS_ITEMS = [
  { icon: "payments" as const, label: "待付款", badge: 1 },
  { icon: "inventory-2" as const, label: "待发货" },
  { icon: "local-shipping" as const, label: "待收货" },
  { icon: "rate-review" as const, label: "待评价" },
];

export default function OrderStatusRow() {
  return (
    <View className="bg-surface-container-low rounded-2xl mx-4 px-2 py-4 flex-row items-center">
      {STATUS_ITEMS.map((item) => (
        <Pressable
          key={item.label}
          className="flex-1 items-center gap-2 active:opacity-60"
        >
          <View className="relative">
            <MaterialIcons name={item.icon} size={24} color={Colors.onSurface} />
            {item.badge && (
              <View className="absolute -top-1 -right-2 bg-error w-4 h-4 rounded-full items-center justify-center">
                <Text className="text-on-error text-[8px] font-bold">
                  {item.badge}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-on-surface text-[10px]">{item.label}</Text>
        </Pressable>
      ))}
      {/* 全部订单 */}
      <Pressable className="flex-1 items-center gap-2 border-l border-outline-variant/20 active:opacity-60">
        <MaterialIcons name="assignment" size={24} color={Colors.onSurface} />
        <Text className="text-on-surface text-[10px]">全部订单</Text>
      </Pressable>
    </View>
  );
}
```

**Step 4: 创建菜单列表**

创建 `src/components/profile/MenuList.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

const MENU_ITEMS = [
  { icon: "location-on" as const, label: "收货地址管理" },
  { icon: "confirmation-number" as const, label: "优惠券", badge: "3张可用" },
  { icon: "receipt-long" as const, label: "我的订单" },
  { icon: "favorite" as const, label: "我的收藏" },
  { icon: "comment" as const, label: "我的评价" },
  { icon: "history-edu" as const, label: "冲泡记录" },
  { icon: "person-add" as const, label: "邀请好友", highlight: true },
  { icon: "settings" as const, label: "设置" },
] as const;

export default function MenuList() {
  return (
    <View className="px-4 gap-0">
      {MENU_ITEMS.map((item) => (
        <Pressable
          key={item.label}
          className={`flex-row items-center py-4 border-b border-outline-variant/10 active:bg-surface-container/50 ${
            item.highlight ? "bg-primary/5" : ""
          }`}
        >
          <MaterialIcons
            name={item.icon}
            size={20}
            color={item.highlight ? Colors.primary : Colors.onSurface}
          />
          <Text
            className={`flex-1 ml-3 text-sm ${
              item.highlight ? "text-primary" : "text-on-surface"
            }`}
          >
            {item.label}
          </Text>
          {item.badge && (
            <View className="bg-tertiary/10 px-2 py-0.5 rounded mr-2">
              <Text className="text-tertiary text-[10px]">{item.badge}</Text>
            </View>
          )}
          <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
        </Pressable>
      ))}
    </View>
  );
}
```

**Step 5: 创建会员权益卡片**

创建 `src/components/profile/MemberBenefitsCard.tsx`：

```typescript
import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

const BENEFITS = ["免费包邮", "专属折扣", "新品优先", "生日礼茶"];

export default function MemberBenefitsCard() {
  return (
    <View className="mx-4 bg-tertiary-fixed/30 border border-tertiary-fixed-dim/20 rounded-2xl p-5 gap-4">
      {/* 头部 */}
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="font-headline text-tertiary text-lg font-bold">
            金叶会员专享
          </Text>
          <Text className="text-on-surface-variant text-xs mt-0.5">
            Scholar of Tea Benefits
          </Text>
        </View>
        <MaterialIcons name="military-tech" size={28} color={Colors.tertiary} />
      </View>

      {/* 权益列表 */}
      <View className="flex-row flex-wrap gap-y-3 gap-x-6">
        {BENEFITS.map((benefit) => (
          <View key={benefit} className="flex-row items-center gap-1.5">
            <MaterialIcons name="verified" size={14} color={Colors.tertiary} />
            <Text className="text-on-surface text-xs">{benefit}</Text>
          </View>
        ))}
      </View>

      {/* 了解更多 */}
      <Pressable className="flex-row items-center gap-1 self-end">
        <Text className="text-tertiary text-xs">了解更多</Text>
        <MaterialIcons name="arrow-right-alt" size={14} color={Colors.tertiary} />
      </Pressable>
    </View>
  );
}
```

**Step 6: 组装个人中心页面**

修改 `src/app/(tabs)/profile.tsx`：

```typescript
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MemberHeader from "@/components/profile/MemberHeader";
import StatsGrid from "@/components/profile/StatsGrid";
import OrderStatusRow from "@/components/profile/OrderStatusRow";
import MenuList from "@/components/profile/MenuList";
import MemberBenefitsCard from "@/components/profile/MemberBenefitsCard";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <MemberHeader />
        <StatsGrid />
        <OrderStatusRow />
        <MenuList />
        <MemberBenefitsCard />
      </ScrollView>
    </View>
  );
}
```

**Step 7: 提交**

```bash
git add src/app/(tabs)/profile.tsx src/components/profile/
git commit -m "feat: 个人中心（会员头部/统计/订单状态/菜单/权益卡）"
```

---

## Task 5: 最终验证

**Step 1: TypeScript 检查**

```bash
npx tsc --noEmit
```

**Step 2: 提交所有变更**

```bash
git add -A
git commit -m "chore: Sprint 3 完成 — 结算 + 个人中心 + 收藏 + 用户状态"
```

---

## Sprint 3 交付清单

| 交付物 | 状态 |
|--------|------|
| 用户状态管理 Store（登录/收藏/地址 + 持久化） | ✅ |
| 收藏功能（商城卡片 + 详情页切换） | ✅ |
| 结算页面（地址/商品/配送/支付/礼盒/价格明细） | ✅ |
| 个人中心（会员头部/统计网格/订单状态/菜单/权益卡） | ✅ |
| 购物车→结算导航联通 | ✅ |
