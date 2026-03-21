# Supabase 对接实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 liji-tea-app 从 100% 硬编码 mock 数据迁移到 Supabase 后端（Auth + Database + Storage + Realtime）

**Architecture:** Zustand Store 直接调用 Supabase Client（方案 A 轻量直连）。不引入额外抽象层，Store 既管状态又负责数据获取。Auth 状态在根 layout 监听，实时订阅在使用页面按需启用。

**Tech Stack:** Expo 55, React Native 0.83, TypeScript, Zustand, NativeWind, @supabase/supabase-js, expo-sqlite

---

## Task 1: 安装依赖 & 环境配置

**Files:**
- Create: `.env`
- Modify: `package.json`

**Step 1: 安装 Supabase 及相关依赖**

Run:
```bash
npx expo install @supabase/supabase-js expo-sqlite expo-secure-store
```

Expected: 3 个包成功安装到 dependencies

**Step 2: 创建环境变量文件**

Create `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://nwozmsackhgffxulirjp.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_RGVDKj0D5qCwpG5bq0Q_4Q_vLcatgkM
```

**Step 3: 确保 `.env` 在 `.gitignore` 中**

检查 `.gitignore`，如果没有 `.env` 行则添加：
```
.env
.env.local
```

**Step 4: 验证应用仍能启动**

Run: `npx expo start` 后检查无编译错误

**Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: 安装 Supabase、expo-sqlite、expo-secure-store 依赖"
```

---

## Task 2: Supabase 客户端单例 & TypeScript 类型

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/types/database.ts`

**Step 1: 创建数据库类型定义**

Create `src/types/database.ts`:
```typescript
/** Supabase 数据库类型定义 */

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  member_tier: string;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address: string;
  is_default: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  origin: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  description: string | null;
  is_new: boolean;
  category: string;
  tagline: string | null;
  tasting_profile: { label: string; description: string; value: number }[] | null;
  brewing_guide: { temperature: string; time: string; amount: string; equipment: string } | null;
  origin_story: string | null;
  process: string[] | null;
  stock: number;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  address_id: string | null;
  status: 'pending' | 'paid' | 'shipping' | 'delivered' | 'cancelled';
  total: number;
  delivery_type: string;
  payment_method: string | null;
  notes: string | null;
  gift_wrap: boolean;
  created_at: string;
  updated_at: string;
  // 关联查询时可能包含
  order_items?: OrderItem[];
  address?: Address;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  // 关联查询时可能包含
  product?: Product;
}

export interface Favorite {
  user_id: string;
  product_id: string;
  created_at: string;
}
```

**Step 2: 创建 Supabase 客户端单例**

Create `src/lib/supabase.ts`:
```typescript
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// 前台自动刷新 token，后台停止刷新
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

**Step 3: 验证 TypeScript 编译无报错**

Run: `npx tsc --noEmit`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add src/lib/supabase.ts src/types/database.ts
git commit -m "feat: 添加 Supabase 客户端单例和数据库类型定义"
```

---

## Task 3: Supabase 数据库表 & RLS & Seed 数据

**Files:**
- Create: `supabase/seed.sql`

此任务在 **Supabase Dashboard SQL Editor** 中执行。

**Step 1: 在 Supabase Dashboard 执行建表 SQL**

在 Dashboard → SQL Editor 中执行：
```sql
-- ============================================
-- 1. profiles 表（用户资料）
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  phone text,
  avatar_url text,
  member_tier text default '新叶会员',
  points integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "用户可查看自己的资料" on public.profiles
  for select using (auth.uid() = id);
create policy "用户可更新自己的资料" on public.profiles
  for update using (auth.uid() = id);
create policy "用户可插入自己的资料" on public.profiles
  for insert with check (auth.uid() = id);

-- 注册时自动创建 profile
create or replace function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', '茶友'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 2. addresses 表（收货地址）
-- ============================================
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text not null,
  address text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

alter table public.addresses enable row level security;

create policy "用户可查看自己的地址" on public.addresses
  for select using (auth.uid() = user_id);
create policy "用户可管理自己的地址" on public.addresses
  for all using (auth.uid() = user_id);

-- ============================================
-- 3. products 表（商品）
-- ============================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  origin text,
  price numeric(10,2) not null,
  unit text default '50g',
  image_url text,
  description text,
  is_new boolean default false,
  category text not null,
  tagline text,
  tasting_profile jsonb,
  brewing_guide jsonb,
  origin_story text,
  process jsonb,
  stock integer default 100,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.products enable row level security;

-- 所有人可读
create policy "所有人可查看上架商品" on public.products
  for select using (is_active = true);

-- ============================================
-- 4. favorites 表（用户收藏）
-- ============================================
create table if not exists public.favorites (
  user_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);

alter table public.favorites enable row level security;

create policy "用户可查看自己的收藏" on public.favorites
  for select using (auth.uid() = user_id);
create policy "用户可管理自己的收藏" on public.favorites
  for all using (auth.uid() = user_id);

-- ============================================
-- 5. orders 表（订单）
-- ============================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) not null,
  address_id uuid references public.addresses(id),
  status text default 'pending',
  total numeric(10,2) not null,
  delivery_type text default 'standard',
  payment_method text,
  notes text,
  gift_wrap boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.orders enable row level security;

create policy "用户可查看自己的订单" on public.orders
  for select using (auth.uid() = user_id);
create policy "用户可创建自己的订单" on public.orders
  for insert with check (auth.uid() = user_id);

-- ============================================
-- 6. order_items 表（订单明细）
-- ============================================
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null,
  unit_price numeric(10,2) not null
);

alter table public.order_items enable row level security;

create policy "用户可查看自己的订单明细" on public.order_items
  for select using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );
create policy "用户可创建自己的订单明细" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

-- ============================================
-- 7. 启用 Realtime
-- ============================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.products;
```

**Step 2: 执行种子数据 SQL**

在 Dashboard → SQL Editor 中执行：
```sql
-- 种子数据：6 个茶产品
insert into public.products (name, origin, price, unit, image_url, category, tagline, is_new, tasting_profile, brewing_guide, origin_story, process, stock) values
(
  '特级大红袍', '福建·武夷山', 398, '50g', null,
  '岩茶', '岩骨花香，回甘悠长', false,
  '[{"label":"香气","description":"兰花香","value":85},{"label":"滋味","description":"醇厚饱满","value":92},{"label":"回甘","description":"岩韵悠长","value":78}]'::jsonb,
  '{"temperature":"98°C","time":"30秒","amount":"8g","equipment":"盖碗"}'::jsonb,
  '武夷山独特的丹霞地貌，赋予岩茶独一无二的岩骨花香。生长于岩缝之间的茶树，根深叶茂，吸收矿物质丰富，造就了大红袍醇厚饱满的口感。',
  '["采摘","萎凋","做青","炭焙"]'::jsonb, 100
),
(
  '西湖龙井', '浙江·杭州', 256, '50g', null,
  '绿茶', '色绿香郁味甘形美', false,
  '[{"label":"香气","description":"豆花香","value":90},{"label":"滋味","description":"鲜爽甘醇","value":88},{"label":"回甘","description":"清新持久","value":82}]'::jsonb,
  '{"temperature":"80°C","time":"45秒","amount":"5g","equipment":"玻璃杯"}'::jsonb,
  '西湖龙井产于杭州西湖周围的群山之中，以色绿、香郁、味甘、形美四绝著称，位列中国十大名茶之首。',
  '["采摘","摊放","杀青","辉锅"]'::jsonb, 100
),
(
  '古树普洱生茶', '云南·勐海', 588, '片', null,
  '普洱', '古树韵味，越陈越香', false,
  '[{"label":"香气","description":"蜜兰香","value":88},{"label":"滋味","description":"浓厚霸气","value":95},{"label":"回甘","description":"深沉绵长","value":90}]'::jsonb,
  '{"temperature":"100°C","time":"15秒","amount":"7g","equipment":"紫砂壶"}'::jsonb,
  '勐海古茶山的百年古树，每一片茶叶都蕴含着时间的味道。古树根系深扎土壤，汲取丰富矿物质，造就浓厚霸气的口感。',
  '["采摘","萎凋","杀青","压制"]'::jsonb, 100
),
(
  '白毫银针', '福建·福鼎', 420, '50g', null,
  '白茶', '满披白毫，如银似雪', true,
  '[{"label":"香气","description":"毫香幽显","value":80},{"label":"滋味","description":"清鲜淡雅","value":75},{"label":"回甘","description":"甜润悠长","value":85}]'::jsonb,
  '{"temperature":"85°C","time":"60秒","amount":"5g","equipment":"盖碗"}'::jsonb,
  '福鼎白茶以白毫银针为最，取自大白茶品种的肥壮芽头，满披白毫，外形如银似雪，汤色杏黄明亮。',
  '["采摘","萎凋","干燥"]'::jsonb, 100
),
(
  '金骏眉红茶', '福建·武夷山', 680, '50g', null,
  '红茶', '花果蜜香，汤色金黄', true,
  '[{"label":"香气","description":"花果蜜香","value":93},{"label":"滋味","description":"甜润饱满","value":90},{"label":"回甘","description":"蜜韵悠长","value":88}]'::jsonb,
  '{"temperature":"90°C","time":"40秒","amount":"5g","equipment":"盖碗"}'::jsonb,
  '金骏眉采用桐木关原生态小种红茶的芽尖制作，每500克成品需要约6万颗芽尖，是顶级红茶的代表。',
  '["采摘","萎凋","揉捻","发酵","烘焙"]'::jsonb, 100
),
(
  '特级茉莉花茶', '广西·横县', 128, '100g', null,
  '花茶', '窨得茉莉无上味，列作人间第一香', false,
  '[{"label":"香气","description":"茉莉花香","value":95},{"label":"滋味","description":"鲜灵甘爽","value":82},{"label":"回甘","description":"花香回味","value":80}]'::jsonb,
  '{"temperature":"85°C","time":"45秒","amount":"5g","equipment":"玻璃杯"}'::jsonb,
  '横县茉莉花茶采用优质绿茶坯与含苞待放的茉莉花反复窨制而成，花香与茶香交融，堪称花茶之王。',
  '["选坯","窨花","通花","起花","复火"]'::jsonb, 100
);
```

注意：`image_url` 暂设为 null，将在 Task 4 上传图片后更新。

**Step 3: 将种子数据保存到项目中供参考**

Create `supabase/seed.sql`，内容为上面两段 SQL 的合并。

**Step 4: 在 Dashboard 中创建 Storage Buckets**

1. 进入 Storage 页面
2. 创建 `product-images` bucket，设为 **Public**
3. 创建 `avatars` bucket，设为 **Public**

**Step 5: 验证**

在 Dashboard → Table Editor 中确认：
- 6 张表已创建（profiles, addresses, products, favorites, orders, order_items）
- products 表有 6 条数据
- RLS 策略已启用

**Step 6: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: 添加 Supabase 建表 SQL 和种子数据"
```

---

## Task 4: 上传产品图片到 Supabase Storage

**手动操作 — 在 Supabase Dashboard 中完成**

**Step 1: 准备 6 张产品图片**

从网络下载或准备 6 张茶叶图片（建议 400x400 以上），命名为：
- `dahongpao.jpg`
- `longjing.jpg`
- `puer.jpg`
- `yinzhen.jpg`
- `jinjunmei.jpg`
- `molihua.jpg`

**Step 2: 上传到 Storage**

在 Dashboard → Storage → `product-images` bucket 中上传 6 张图片。

**Step 3: 更新 products 表的 image_url**

在 SQL Editor 中执行（根据实际 product id 替换）：
```sql
-- 先查询 product id
select id, name from products order by created_at;

-- 然后更新 image_url（把 <id> 替换为实际 UUID）
update products set image_url = 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/dahongpao.jpg' where name = '特级大红袍';
update products set image_url = 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/longjing.jpg' where name = '西湖龙井';
update products set image_url = 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/puer.jpg' where name = '古树普洱生茶';
update products set image_url = 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/yinzhen.jpg' where name = '白毫银针';
update products set image_url = 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/jinjunmei.jpg' where name = '金骏眉红茶';
update products set image_url = 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/molihua.jpg' where name = '特级茉莉花茶';
```

**Step 4: 验证图片 URL 可访问**

在浏览器中打开任一 URL 确认图片加载正常。

---

## Task 5: 创建 productStore（商品状态管理）

**Files:**
- Create: `src/stores/productStore.ts`
- Modify: `src/data/products.ts` (保留类型导出，删除数据导出)

**Step 1: 创建 productStore**

Create `src/stores/productStore.ts`:
```typescript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Product as DBProduct } from '@/types/database';

/** 前端使用的 Product 类型（兼容现有组件） */
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
  tastingProfile?: { label: string; description: string; value: number }[];
  brewingGuide?: { temperature: string; time: string; amount: string; equipment: string };
  originStory?: string;
  process?: string[];
  stock?: number;
}

/** 将数据库行映射为前端 Product 类型 */
function mapProduct(row: DBProduct): Product {
  return {
    id: row.id,
    name: row.name,
    origin: row.origin ?? '',
    price: Number(row.price),
    unit: row.unit,
    image: row.image_url ?? '',
    description: row.description ?? undefined,
    isNew: row.is_new,
    category: row.category,
    tagline: row.tagline ?? undefined,
    tastingProfile: row.tasting_profile ?? undefined,
    brewingGuide: row.brewing_guide ?? undefined,
    originStory: row.origin_story ?? undefined,
    process: row.process ?? undefined,
    stock: row.stock,
  };
}

interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;

  fetchProducts: () => Promise<void>;
  fetchProductById: (id: string) => Promise<Product | null>;
  searchProducts: (query: string) => Promise<Product[]>;
  /** 实时回调：更新单个产品（库存等） */
  updateProduct: (updated: DBProduct) => void;
}

export const useProductStore = create<ProductState>()((set, get) => ({
  products: [],
  loading: false,
  error: null,

  fetchProducts: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ products: (data ?? []).map(mapProduct), loading: false });
  },

  fetchProductById: async (id) => {
    // 先从本地缓存查找
    const cached = get().products.find((p) => p.id === id);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return mapProduct(data);
  },

  searchProducts: async (query) => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,origin.ilike.%${query}%`);

    if (error || !data) return [];
    return data.map(mapProduct);
  },

  updateProduct: (updated) => {
    set((state) => ({
      products: state.products.map((p) =>
        p.id === updated.id ? mapProduct(updated) : p
      ),
    }));
  },
}));
```

**Step 2: 更新 `src/data/products.ts` — 仅保留类型和分类常量**

将 `src/data/products.ts` 修改为只导出类型和常量，移除硬编码数据：
```typescript
// 重新导出 productStore 中的 Product 类型
export type { Product } from '@/stores/productStore';

/** 茶类分类 */
export const TEA_CATEGORIES = [
  '全部',
  '岩茶',
  '绿茶',
  '白茶',
  '红茶',
  '乌龙',
  '普洱',
  '花茶',
] as const;

export type TeaCategory = (typeof TEA_CATEGORIES)[number];
```

注意：`TastingProfile` 和 `BrewingGuide` 类型现在内联在 Product 中。如果有组件单独导入这些类型，需要从 `src/types/database.ts` 导出或在 `src/data/products.ts` 中重新声明。

**Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/stores/productStore.ts src/data/products.ts
git commit -m "feat: 创建 productStore 对接 Supabase 商品数据"
```

---

## Task 6: 改造首页和商城页 — 数据源从 mock 切换到 productStore

**Files:**
- Modify: `src/components/home/FeaturedProducts.tsx`
- Modify: `src/components/home/NewArrivals.tsx`
- Modify: `src/app/(tabs)/index.tsx`
- Modify: `src/app/(tabs)/shop.tsx`
- Modify: `src/app/product/[id].tsx`

**Step 1: 修改 FeaturedProducts.tsx**

`src/components/home/FeaturedProducts.tsx` — 将 `import { featuredProducts } from "@/data/products"` 替换为从 store 读取：

```typescript
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import ProductCard from "@/components/product/ProductCard";
import { useProductStore } from "@/stores/productStore";

export default function FeaturedProducts() {
  const router = useRouter();
  const { products, loading } = useProductStore();
  // 取前 3 个作为推荐
  const featuredProducts = products.slice(0, 3);

  if (loading && products.length === 0) {
    return (
      <View className="h-40 items-center justify-center">
        <ActivityIndicator color="#5b7553" />
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="flex-row justify-between items-end">
        <Text className="font-headline text-xl text-on-surface">本季推荐</Text>
        <Pressable onPress={() => router.push("/(tabs)/shop" as any)}>
          <Text className="text-tertiary text-sm font-medium">
            查看全部 &gt;
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-4"
      >
        {featuredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onPress={() => router.push(`/product/${product.id}` as any)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
```

**Step 2: 修改 NewArrivals.tsx**

`src/components/home/NewArrivals.tsx` — 将 `import { newArrivals } from "@/data/products"` 替换为从 store 读取：

```typescript
// 第 6 行改为：
import { useProductStore } from "@/stores/productStore";

// 在函数体内第一行添加：
const { products } = useProductStore();
const newArrivals = products.filter((p) => p.isNew);
```

**Step 3: 修改首页 — 加载数据**

`src/app/(tabs)/index.tsx` — 在组件挂载时触发 fetchProducts：

```typescript
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import TopAppBar from "@/components/home/TopAppBar";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryRow from "@/components/home/CategoryRow";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import CultureBanner from "@/components/home/CultureBanner";
import NewArrivals from "@/components/home/NewArrivals";
import SeasonalStory from "@/components/home/SeasonalStory";
import { useProductStore } from "@/stores/productStore";

export default function HomeScreen() {
  const fetchProducts = useProductStore((s) => s.fetchProducts);

  useEffect(() => {
    fetchProducts();
  }, []);

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

**Step 4: 修改商城页**

`src/app/(tabs)/shop.tsx` — 将 `allProducts` 从 mock 改为 store：

Line 10: 将 `import { allProducts, type TeaCategory } from "@/data/products"` 改为：
```typescript
import { type TeaCategory, TEA_CATEGORIES } from "@/data/products";
import { useProductStore } from "@/stores/productStore";
```

在函数体内（约 line 16 后）添加：
```typescript
const { products: allProducts, loading } = useProductStore();
```

其余逻辑不变——`filteredProducts` 的 useMemo 依然使用 `allProducts`。

**Step 5: 修改商品详情页**

`src/app/product/[id].tsx` — Line 7: 将 `import { allProducts } from "@/data/products"` 改为：
```typescript
import { useProductStore } from "@/stores/productStore";
```

Line 23: 将 `const product = allProducts.find((p) => p.id === id)` 改为：
```typescript
const products = useProductStore((s) => s.products);
const product = products.find((p) => p.id === id);
```

**Step 6: 修改结算页**

`src/app/checkout.tsx` — Line 9: 将 `import { allProducts } from "@/data/products"` 改为：
```typescript
import { useProductStore } from "@/stores/productStore";
```

Line 24-28: 将直接购买的产品查找改为：
```typescript
const products = useProductStore((s) => s.products);

const orderItems = useMemo(() => {
  if (productId) {
    const product = products.find((p) => p.id === productId);
    if (product) return [{ product, quantity: 1 }];
  }
  return cartItems;
}, [productId, cartItems, products]);
```

**Step 7: 验证应用启动和页面加载**

Run: `npx expo start`
验证：首页、商城页、商品详情页能正确加载 Supabase 数据

**Step 8: Commit**

```bash
git add src/components/home/FeaturedProducts.tsx src/components/home/NewArrivals.tsx src/app/\(tabs\)/index.tsx src/app/\(tabs\)/shop.tsx src/app/product/\[id\].tsx src/app/checkout.tsx
git commit -m "feat: 首页/商城/详情/结算页数据源切换到 Supabase"
```

---

## Task 7: 改造 userStore — 对接 Supabase Auth

**Files:**
- Modify: `src/stores/userStore.ts`
- Modify: `src/app/_layout.tsx`

**Step 1: 重写 userStore.ts**

完全重写 `src/stores/userStore.ts`：
```typescript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Profile, Address } from '@/types/database';

export type { Address } from '@/types/database';

interface UserState {
  // Auth 状态
  session: Session | null;
  initialized: boolean; // auth 状态是否已加载完毕

  // Profile 数据
  profile: Profile | null;
  addresses: Address[];
  favorites: string[]; // product IDs

  // Auth 方法
  signUp: (email: string, password: string, name?: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  setInitialized: () => void;

  // Profile 方法
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'name' | 'phone' | 'avatar_url'>>) => Promise<string | null>;

  // Address 方法
  fetchAddresses: () => Promise<void>;
  addAddress: (address: Omit<Address, 'id' | 'user_id' | 'created_at'>) => Promise<string | null>;
  removeAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  getDefaultAddress: () => Address | undefined;

  // Favorites 方法
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (productId: string) => Promise<void>;
  isFavorite: (productId: string) => boolean;

  // 兼容旧代码
  isLoggedIn: boolean;
  name: string;
  phone: string;
  avatar: string;
  memberTier: string;
  points: number;
}

export const useUserStore = create<UserState>()((set, get) => ({
  session: null,
  initialized: false,
  profile: null,
  addresses: [],
  favorites: [],

  // 兼容旧代码的计算属性
  get isLoggedIn() { return !!get().session; },
  get name() { return get().profile?.name ?? ''; },
  get phone() { return get().profile?.phone ?? ''; },
  get avatar() { return get().profile?.avatar_url ?? ''; },
  get memberTier() { return get().profile?.member_tier ?? '新叶会员'; },
  get points() { return get().profile?.points ?? 0; },

  setSession: (session) => set({ session }),
  setInitialized: () => set({ initialized: true }),

  signUp: async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name ?? '茶友' } },
    });
    return error?.message ?? null;
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, addresses: [], favorites: [] });
  },

  fetchProfile: async () => {
    const userId = get().session?.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) set({ profile: data });
  },

  updateProfile: async (updates) => {
    const userId = get().session?.user?.id;
    if (!userId) return '未登录';

    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) return error.message;
    await get().fetchProfile();
    return null;
  },

  fetchAddresses: async () => {
    const userId = get().session?.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (data) set({ addresses: data });
  },

  addAddress: async (address) => {
    const userId = get().session?.user?.id;
    if (!userId) return '未登录';

    // 如果设为默认地址，先取消其他默认
    if (address.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { error } = await supabase
      .from('addresses')
      .insert({ ...address, user_id: userId });

    if (error) return error.message;
    await get().fetchAddresses();
    return null;
  },

  removeAddress: async (id) => {
    await supabase.from('addresses').delete().eq('id', id);
    await get().fetchAddresses();
  },

  setDefaultAddress: async (id) => {
    const userId = get().session?.user?.id;
    if (!userId) return;

    // 先全部取消默认
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId);
    // 设置新默认
    await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id);

    await get().fetchAddresses();
  },

  getDefaultAddress: () => get().addresses.find((a) => a.is_default),

  fetchFavorites: async () => {
    const userId = get().session?.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', userId);

    if (data) set({ favorites: data.map((f) => f.product_id) });
  },

  toggleFavorite: async (productId) => {
    const userId = get().session?.user?.id;
    if (!userId) return;

    const isFav = get().favorites.includes(productId);
    if (isFav) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);
      set((state) => ({ favorites: state.favorites.filter((id) => id !== productId) }));
    } else {
      await supabase
        .from('favorites')
        .insert({ user_id: userId, product_id: productId });
      set((state) => ({ favorites: [...state.favorites, productId] }));
    }
  },

  isFavorite: (productId) => get().favorites.includes(productId),
}));
```

**Step 2: 修改根 Layout — 添加 Auth 状态监听**

`src/app/_layout.tsx` — 替换为：
```typescript
import "../../global.css";
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
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/stores/userStore";

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

  const setSession = useUserStore((s) => s.setSession);
  const setInitialized = useUserStore((s) => s.setInitialized);
  const fetchProfile = useUserStore((s) => s.fetchProfile);
  const fetchAddresses = useUserStore((s) => s.fetchAddresses);
  const fetchFavorites = useUserStore((s) => s.fetchFavorites);

  useEffect(() => {
    // 加载现有 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized();
      if (session) {
        fetchProfile();
        fetchAddresses();
        fetchFavorites();
      }
    });

    // 监听 auth 状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          fetchProfile();
          fetchAddresses();
          fetchFavorites();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
```

**Step 3: 验证编译**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/stores/userStore.ts src/app/_layout.tsx
git commit -m "feat: userStore 对接 Supabase Auth + 根 Layout 添加 auth 监听"
```

---

## Task 8: 创建登录/注册页面

**Files:**
- Create: `src/app/login.tsx`

**Step 1: 创建登录/注册页面**

Create `src/app/login.tsx`:
```typescript
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { useUserStore } from '@/stores/userStore';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useUserStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('提示', '请填写邮箱和密码');
      return;
    }

    setLoading(true);
    let error: string | null;

    if (isSignUp) {
      error = await signUp(email.trim(), password, name.trim() || undefined);
      if (!error) {
        Alert.alert('注册成功', '请查收验证邮件后登录');
        setIsSignUp(false);
      }
    } else {
      error = await signIn(email.trim(), password);
      if (!error) {
        router.back();
      }
    }

    if (error) Alert.alert('错误', error);
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: isSignUp ? '注册' : '登录',
          headerTitleStyle: { fontFamily: 'Manrope_500Medium', fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center gap-6">
          {/* Logo 区域 */}
          <View className="items-center gap-3 mb-8">
            <Text className="font-headline text-4xl text-primary font-bold">李记茶</Text>
            <Text className="text-outline text-sm">一叶一世界</Text>
          </View>

          {/* 表单 */}
          {isSignUp && (
            <View className="gap-2">
              <Text className="text-on-surface-variant text-sm">昵称</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="您的昵称"
                placeholderTextColor={Colors.outline}
                className="bg-surface-container-low rounded-xl px-4 py-3.5 text-on-surface"
                autoCapitalize="none"
              />
            </View>
          )}

          <View className="gap-2">
            <Text className="text-on-surface-variant text-sm">邮箱</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={Colors.outline}
              className="bg-surface-container-low rounded-xl px-4 py-3.5 text-on-surface"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View className="gap-2">
            <Text className="text-on-surface-variant text-sm">密码</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="至少 6 位"
              placeholderTextColor={Colors.outline}
              className="bg-surface-container-low rounded-xl px-4 py-3.5 text-on-surface"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* 提交按钮 */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            className="bg-primary-container rounded-full py-4 items-center justify-center mt-4 active:bg-primary"
          >
            <Text className="text-on-primary font-medium text-base">
              {loading ? '请稍候...' : isSignUp ? '注册' : '登录'}
            </Text>
          </Pressable>

          {/* 切换登录/注册 */}
          <Pressable onPress={() => setIsSignUp(!isSignUp)} className="items-center py-2">
            <Text className="text-tertiary text-sm">
              {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
```

**Step 2: 验证页面可导航**

在应用中测试：`router.push('/login')` 可正确打开登录页。

**Step 3: Commit**

```bash
git add src/app/login.tsx
git commit -m "feat: 创建邮箱密码登录/注册页面"
```

---

## Task 9: 创建 orderStore & 改造结算/追踪页

**Files:**
- Create: `src/stores/orderStore.ts`
- Modify: `src/app/checkout.tsx`
- Modify: `src/app/tracking.tsx`

**Step 1: 创建 orderStore**

Create `src/stores/orderStore.ts`:
```typescript
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem } from '@/types/database';
import { useUserStore } from '@/stores/userStore';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;

  createOrder: (params: {
    items: { productId: string; quantity: number; unitPrice: number }[];
    addressId: string;
    total: number;
    deliveryType: string;
    paymentMethod: string;
    notes?: string;
    giftWrap: boolean;
  }) => Promise<{ orderId: string | null; error: string | null }>;

  fetchOrders: () => Promise<void>;
  fetchOrderById: (id: string) => Promise<void>;
  /** 实时回调：更新订单状态 */
  updateOrder: (updated: Order) => void;
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  orders: [],
  currentOrder: null,
  loading: false,

  createOrder: async (params) => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) return { orderId: null, error: '未登录' };

    // 1. 创建订单主记录
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        address_id: params.addressId,
        total: params.total,
        delivery_type: params.deliveryType,
        payment_method: params.paymentMethod,
        notes: params.notes ?? null,
        gift_wrap: params.giftWrap,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError || !order) {
      return { orderId: null, error: orderError?.message ?? '创建订单失败' };
    }

    // 2. 创建订单明细
    const orderItems = params.items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      return { orderId: null, error: itemsError.message };
    }

    return { orderId: order.id, error: null };
  },

  fetchOrders: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) return;

    set({ loading: true });
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, product:products(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    set({ orders: data ?? [], loading: false });
  },

  fetchOrderById: async (id) => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, product:products(*)), address:addresses(*)')
      .eq('id', id)
      .single();

    if (data) set({ currentOrder: data });
  },

  updateOrder: (updated) => {
    set((state) => ({
      orders: state.orders.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
      currentOrder: state.currentOrder?.id === updated.id
        ? { ...state.currentOrder, ...updated }
        : state.currentOrder,
    }));
  },
}));
```

**Step 2: 修改结算页 — 提交真实订单**

`src/app/checkout.tsx` — 修改 `handleSubmit` 函数（约 line 48-59）：

添加 import:
```typescript
import { useOrderStore } from "@/stores/orderStore";
```

替换 `handleSubmit`：
```typescript
const { createOrder } = useOrderStore();

const handleSubmit = async () => {
  const userId = useUserStore.getState().session?.user?.id;
  if (!userId) {
    router.push('/login');
    return;
  }
  if (!address) {
    Alert.alert('提示', '请添加收货地址');
    return;
  }

  const { orderId, error } = await createOrder({
    items: orderItems.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.product.price,
    })),
    addressId: address.id,
    total,
    deliveryType: delivery,
    paymentMethod: payment,
    notes: note || undefined,
    giftWrap: giftBox,
  });

  if (error) {
    Alert.alert('订单失败', error);
    return;
  }

  Alert.alert('订单已提交', `订单金额: ¥${total}`, [
    {
      text: '确定',
      onPress: () => {
        if (!productId) clearCart();
        router.replace('/(tabs)' as any);
      },
    },
  ]);
};
```

**Step 3: Commit**

```bash
git add src/stores/orderStore.ts src/app/checkout.tsx
git commit -m "feat: 创建 orderStore + 结算页提交真实订单到 Supabase"
```

---

## Task 10: 实时订阅 — 订单状态 & 商品库存

**Files:**
- Modify: `src/app/tracking.tsx`
- Modify: `src/app/product/[id].tsx`

**Step 1: 商品详情页添加库存实时订阅**

`src/app/product/[id].tsx` — 在组件内添加实时订阅 hook：

在 imports 中添加：
```typescript
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
```

在 `const product = ...` 之后添加：
```typescript
// 实时订阅库存变化
useEffect(() => {
  if (!product) return;

  const channel = supabase
    .channel(`product-${product.id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${product.id}` },
      (payload) => {
        useProductStore.getState().updateProduct(payload.new as any);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [product?.id]);
```

**Step 2: 订单追踪页添加实时订阅（结构性改造）**

`src/app/tracking.tsx` 当前是完全硬编码的。由于 tracking 页需要接收订单 ID 参数并从 Supabase 读取真实数据，这是一个较大的改造。当前阶段保留现有 mock UI，仅添加实时订阅的基础结构：

在 tracking.tsx 头部添加：
```typescript
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useOrderStore } from "@/stores/orderStore";
import { useUserStore } from "@/stores/userStore";
```

在组件函数体内添加订单实时订阅：
```typescript
const userId = useUserStore((s) => s.session?.user?.id);
const { updateOrder } = useOrderStore();

useEffect(() => {
  if (!userId) return;

  const channel = supabase
    .channel('user-orders')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
      (payload) => {
        updateOrder(payload.new as any);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

**Step 3: Commit**

```bash
git add src/app/product/\[id\].tsx src/app/tracking.tsx
git commit -m "feat: 添加商品库存和订单状态实时订阅"
```

---

## Task 11: 路由保护 & Profile 页改造

**Files:**
- Modify: `src/app/cart.tsx`
- Modify: `src/app/(tabs)/profile.tsx`

**Step 1: 购物车页添加登录检查**

`src/app/cart.tsx` — 在结算按钮（line 102-109）的 onPress 中添加登录检查：

添加 import:
```typescript
import { useUserStore } from "@/stores/userStore";
```

在函数体内添加：
```typescript
const session = useUserStore((s) => s.session);
```

修改结算按钮的 onPress：
```typescript
onPress={() => {
  if (!session) {
    router.push('/login');
    return;
  }
  router.push('/checkout' as any);
}}
```

**Step 2: Profile 页添加未登录状态**

`src/app/(tabs)/profile.tsx` — 添加登录检查：

```typescript
import { ScrollView, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useUserStore } from "@/stores/userStore";
import MemberHeader from "@/components/profile/MemberHeader";
import StatsGrid from "@/components/profile/StatsGrid";
import OrderStatusRow from "@/components/profile/OrderStatusRow";
import MenuList from "@/components/profile/MenuList";
import MemberBenefitsCard from "@/components/profile/MemberBenefitsCard";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useUserStore((s) => s.session);

  // 未登录状态
  if (!session) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-6" style={{ paddingTop: insets.top }}>
        <MaterialIcons name="account-circle" size={80} color={Colors.outlineVariant} />
        <Text className="text-on-surface-variant text-base">登录后查看个人信息</Text>
        <Pressable
          onPress={() => router.push('/login')}
          className="bg-primary-container px-8 py-3 rounded-full"
        >
          <Text className="text-on-primary font-medium">登录 / 注册</Text>
        </Pressable>
      </View>
    );
  }

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

**Step 3: Commit**

```bash
git add src/app/cart.tsx src/app/\(tabs\)/profile.tsx
git commit -m "feat: 购物车登录检查 + Profile 页未登录状态"
```

---

## Task 12: 最终验证 & 清理

**Files:**
- Verify all modified files compile
- Clean up unused imports

**Step 1: TypeScript 全量检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

**Step 2: 启动应用并逐页验证**

Run: `npx expo start`

验证清单：
- [ ] 首页加载 Supabase 产品数据
- [ ] 商城页显示产品列表，分类筛选正常
- [ ] 商品详情页正确显示
- [ ] 登录页可以注册和登录
- [ ] 登录后 Profile 页显示用户信息
- [ ] 收藏功能正常（登录后）
- [ ] 购物车未登录时点结算跳转登录页
- [ ] 登录后结算能创建真实订单

**Step 3: 移除不再使用的 mock 数据导出**

确认 `src/data/products.ts` 中不再导出 `allProducts`、`featuredProducts`、`newArrivals`。

检查是否还有其他文件 import 这些已移除的导出，如有则修复。

**Step 4: 最终 Commit**

```bash
git add -A
git commit -m "chore: Supabase 对接完成 — 清理未使用的 mock 数据导出"
```

---

## 任务依赖关系

```
Task 1 (依赖安装)
  ↓
Task 2 (客户端 + 类型)
  ↓
Task 3 (数据库建表) ← 需在 Supabase Dashboard 手动执行
  ↓
Task 4 (上传图片) ← 需在 Supabase Dashboard 手动执行
  ↓
Task 5 (productStore)
  ↓
Task 6 (首页/商城切换数据源) ← 依赖 Task 5
  ↓
Task 7 (userStore + Auth)
  ↓
Task 8 (登录页) ← 依赖 Task 7
  ↓
Task 9 (orderStore + 结算) ← 依赖 Task 7
  ↓
Task 10 (实时订阅)
  ↓
Task 11 (路由保护 + Profile) ← 依赖 Task 7, 8
  ↓
Task 12 (最终验证)
```

**注意：Task 3 和 Task 4 需要用户在 Supabase Dashboard 中手动操作。**
