# 商家端 UI 重设计实施计划（v4.4.0）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把商家后台从"品牌色 + chips + FlatList"升级为 Editorial × Bento 视觉语言，含 Hero 数字、Bento 详情、Toast 反馈与轻量入场动效，零后端改动。

**Architecture:** 先落地 Design Token（色板）+ Toast 系统 + 5 个新组件（ScreenHeader / HeroStats / StatusBadge / BentoBlock / Timeline / StickyActions）；再就地改造 7 个既有组件视觉；最后按"订单→售后→商品→员工"顺序重排 7 个页面。每个 Task 完成即 `npm run check` + commit。

**Tech Stack:** Expo 55 · React Native 0.83 · TypeScript 5.9 · NativeWind 5 · Zustand · react-native-reanimated。

**参考设计稿：** `docs/plans/2026-04-17-merchant-ui-redesign-design.md`

**公共约定：**
- 所有新样式只影响 `src/app/merchant/*` 与 `src/components/merchant/*`
- 商家专属色板放 `src/constants/MerchantColors.ts`，不污染 `Colors.ts`
- 每个 Task 结束统一 `npm run check`，必须全绿再 commit
- 提交前缀统一：`feat(merchant-ui): <简述>`

---

## Task 1：Design Token（MerchantColors）

**Files:**
- Create: `src/constants/MerchantColors.ts`

**Step 1：建色板文件**

```ts
/**
 * 商家端专属色板。
 *
 * 作用域：仅 src/app/merchant/* 与 src/components/merchant/*。
 * 与 C 端的 Colors.ts 并存，不替换、不注入全局。
 *
 * 语义色命名（而非视觉名）：方便后续换肤或做深色模式时只替换 token。
 */
export const MerchantColors = {
  // Ink / Paper 基础灰阶
  ink900: "#0e1411",   // 大号数字 / 页面标题
  ink500: "#5a655c",   // 副标题
  paper:  "#faf6ee",   // 卡片底（比全局 background 白一点）
  line:   "#e6dfd1",   // 描边 / 分隔线

  // 语义状态色
  statusWait: "#a77432", // 琥珀：待发货 / 待审核
  statusGo:   "#4d7a4f", // 茶青：进行中
  statusDone: "#6b6b6b", // 墨灰：已完成
  statusStop: "#a53b3b", // 朱砂：已拒绝 / 已取消
} as const;

export type MerchantColorKey = keyof typeof MerchantColors;
```

**Step 2：验证**

Run: `npm run typecheck`
Expected: PASS。

**Step 3：提交**

```bash
git add src/constants/MerchantColors.ts
git commit -m "feat(merchant-ui): 新增商家专属色板 MerchantColors

背景：v4.4.0 重设计方案（见 docs/plans/2026-04-17-merchant-ui-redesign-
design.md §2.1）引入了 ink/paper/line 基础灰阶与 4 种语义状态色。
为避免污染 C 端 Colors.ts，单独放在 MerchantColors.ts。

改动：
- ink900 / ink500 / paper / line 四个基础灰阶 token
- statusWait / statusGo / statusDone / statusStop 四个语义状态色
- 命名走语义而非视觉，方便后续换肤或接入深色模式

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2：Toast 状态 store

**Files:**
- Create: `src/stores/merchantToastStore.ts`
- Create: `tests/merchantToast.test.ts`

**目标：** 最小 Zustand store 承载当前 toast 消息；纯状态，不涉及动画。

**Step 1：写失败测试**

`tests/merchantToast.test.ts`：

```ts
import assert from "node:assert/strict";
import { runCase } from "./testHarness";
import {
  pushMerchantToast,
  dismissMerchantToast,
  getMerchantToastState,
  resetMerchantToastStore,
} from "@/stores/merchantToastStore";

export async function runMerchantToastTests() {
  console.log("[Suite] merchantToast");

  await runCase("初始态无消息", () => {
    resetMerchantToastStore();
    assert.equal(getMerchantToastState().current, null);
  });

  await runCase("push 成功消息后 current 可读", () => {
    resetMerchantToastStore();
    pushMerchantToast({ kind: "success", title: "发货成功", detail: "LJ-001" });
    const state = getMerchantToastState();
    assert.equal(state.current?.kind, "success");
    assert.equal(state.current?.title, "发货成功");
  });

  await runCase("dismiss 后 current 清空", () => {
    resetMerchantToastStore();
    pushMerchantToast({ kind: "error", title: "失败" });
    dismissMerchantToast();
    assert.equal(getMerchantToastState().current, null);
  });

  await runCase("连续 push 替换上一条（单 slot）", () => {
    resetMerchantToastStore();
    pushMerchantToast({ kind: "success", title: "一" });
    pushMerchantToast({ kind: "success", title: "二" });
    assert.equal(getMerchantToastState().current?.title, "二");
  });
}
```

挂到 `tests/run-tests.ts`。Run: `npm run test`，Expected: FAIL。

**Step 2：实现 store**

`src/stores/merchantToastStore.ts`：

```ts
import { create } from "zustand";

export type MerchantToastKind = "success" | "error" | "info";

export interface MerchantToast {
  id: number;
  kind: MerchantToastKind;
  title: string;
  detail?: string;
}

interface State {
  current: MerchantToast | null;
  sequence: number;
}

interface Actions {
  push: (payload: Omit<MerchantToast, "id">) => void;
  dismiss: () => void;
  _reset: () => void;
}

// 单 slot 策略：同一时刻只显示一条 Toast，避免堆栈干扰员工视线。
// 新 push 直接替换旧的。
export const useMerchantToastStore = create<State & Actions>((set, get) => ({
  current: null,
  sequence: 0,
  push: (payload) =>
    set((s) => ({
      current: { id: s.sequence + 1, ...payload },
      sequence: s.sequence + 1,
    })),
  dismiss: () => set({ current: null }),
  _reset: () => set({ current: null, sequence: 0 }),
}));

// 便捷 API：页面里直接调用，避免每次拿 store.getState()。
export function pushMerchantToast(payload: Omit<MerchantToast, "id">) {
  useMerchantToastStore.getState().push(payload);
}
export function dismissMerchantToast() {
  useMerchantToastStore.getState().dismiss();
}
export function getMerchantToastState() {
  return useMerchantToastStore.getState();
}
export function resetMerchantToastStore() {
  useMerchantToastStore.getState()._reset();
}
```

挂入口：

```ts
// tests/run-tests.ts 追加 import + suites.push
import { runMerchantToastTests } from "./merchantToast.test";
// ...
runMerchantToastTests,
```

Run: `npm run test`，Expected: 4/4 PASS。

**Step 3：提交**

```bash
git add src/stores/merchantToastStore.ts tests/merchantToast.test.ts tests/run-tests.ts
git commit -m "feat(merchant-ui): 新增 merchantToastStore（单 slot 顶部提示）

背景：现有商家端用 Alert.alert 做反馈，打断操作流。v4.4.0 改用顶部 Toast
（见设计稿 §5.3）。本 Task 只落状态层，动画组件见 Task 3。

改动：
- merchantToastStore：current（单 slot）+ sequence（自增 id）
- push/dismiss/_reset 三个 action；新 push 直接替换旧 Toast
- 便捷函数 pushMerchantToast / dismissMerchantToast，避免各页面反复拿 store
- 4 个单测覆盖初始态 / push / dismiss / 连续 push 替换四种场景

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3：Toast 视图组件 + 挂根布局

**Files:**
- Create: `src/components/merchant/MerchantToast.tsx`
- Modify: `src/app/merchant/_layout.tsx`

**目标：** 顶部滑入的 Toast 组件，3 秒自动消失；只挂在 `/merchant/*` 的 `_layout` 下，不影响 C 端。

**Step 1：实现组件**

`src/components/merchant/MerchantToast.tsx`：

```tsx
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { MerchantColors } from "@/constants/MerchantColors";
import {
  dismissMerchantToast,
  useMerchantToastStore,
  type MerchantToastKind,
} from "@/stores/merchantToastStore";

const AUTO_DISMISS_MS = 3000;

const KIND_META: Record<MerchantToastKind, { color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  success: { color: MerchantColors.statusGo,   icon: "check-circle" },
  error:   { color: MerchantColors.statusStop, icon: "error-outline" },
  info:    { color: MerchantColors.ink500,     icon: "info-outline" },
};

// Toast 顶部承载组件。单 slot 策略：同时只显示一条；新消息到来立即替换。
// 动画用 Reanimated 的 FadeInUp / FadeOutUp 预设，零自定义时间线。
export function MerchantToast() {
  const current = useMerchantToastStore((s) => s.current);

  // 每条消息基于 id 起一次 3 秒定时；新消息替换后旧定时自动失效（id 不同）。
  useEffect(() => {
    if (!current) return;
    const capturedId = current.id;
    const timer = setTimeout(() => {
      // 只在没有新消息覆盖时才 dismiss，避免误清新消息
      if (useMerchantToastStore.getState().current?.id === capturedId) {
        dismissMerchantToast();
      }
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [current?.id]);

  if (!current) return null;

  const meta = KIND_META[current.kind];

  return (
    <Animated.View
      key={current.id}
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="box-none"
      className="absolute left-0 right-0 top-0 z-50 px-4 pt-12"
    >
      <Pressable
        onPress={dismissMerchantToast}
        style={{
          backgroundColor: MerchantColors.paper,
          borderColor: MerchantColors.line,
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          shadowColor: "#0e1411",
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 3,
        }}
      >
        <MaterialIcons name={meta.icon} size={20} color={meta.color} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: MerchantColors.ink900, fontWeight: "600", fontSize: 14 }}>
            {current.title}
          </Text>
          {current.detail ? (
            <Text style={{ color: MerchantColors.ink500, fontSize: 12, marginTop: 2 }}>
              {current.detail}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
```

**Step 2：挂根布局**

修改 `src/app/merchant/_layout.tsx`——只改 `return` 部分，守卫逻辑保持不变：

```tsx
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";

import { MerchantToast } from "@/components/merchant/MerchantToast";
import { isMerchantStaff } from "@/lib/userRole";
import { useUserStore } from "@/stores/userStore";

export default function MerchantLayout() {
  const session = useUserStore((s) => s.session);
  const role = useUserStore((s) => s.role);

  if (!session) return <Redirect href="/login" />;
  if (!isMerchantStaff(role)) return <Redirect href="/(tabs)" />;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <MerchantToast />
    </View>
  );
}
```

**Step 3：验证**

Run: `npm run typecheck && npm run lint`。Expected: PASS。
手动走查留到 Task 11（Alert→Toast 迁移）后再做。

**Step 4：提交**

```bash
git add src/components/merchant/MerchantToast.tsx src/app/merchant/_layout.tsx
git commit -m "feat(merchant-ui): 新增 MerchantToast 组件并挂入 /merchant 根布局

背景：v4.4.0 用 Toast 替代 Alert.alert（见设计稿 §5.3）。本 Task 提供
视图组件 + 根挂载，实际调用点迁移见 Task 11。

改动：
- MerchantToast：读取 merchantToastStore.current，顶部 SafeArea 区域
  FadeInUp/FadeOutUp 滑入滑出；3 秒自动 dismiss，点击可手动关闭。
- 三种 kind（success / error / info）对应 status-go / status-stop / ink-500，
  icon 走 MaterialIcons 内置集。
- 单 slot：新消息替换旧的，定时器捕获 id，避免竞态误 dismiss。
- merchant/_layout.tsx 在 Stack 外套一层 View 挂 Toast，保证所有 /merchant
  子页面共享，不影响 C 端。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4：`MerchantScreenHeader` 衬线大标题

**Files:**
- Create: `src/components/merchant/MerchantScreenHeader.tsx`

**目标：** 替代各列表页里散落的"AppHeader+页内自写标题"，统一成一个组件：左侧衬线大标题、右侧可选操作（如"⟳ 刷新"）。

**实现：**

```tsx
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";

interface Props {
  title: string;
  /** 右侧可选操作按钮（常见：刷新、新建）。无则不渲染。 */
  actionIcon?: keyof typeof MaterialIcons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}

// 商家端页面级大标题。
// - 采用 Noto Serif SC 32pt 粗体，属于设计系统里的 display 层级。
// - 下方留 12px 节奏空隙，交给父容器决定是否再挂 Hero 数字 / 筛选栏。
export function MerchantScreenHeader({
  title,
  actionIcon,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View className="px-5 pt-5 pb-3 flex-row items-end justify-between">
      <Text
        style={{
          color: MerchantColors.ink900,
          fontFamily: "NotoSerifSC_700Bold",
          fontSize: 32,
          lineHeight: 40,
        }}
      >
        {title}
      </Text>
      {onAction && actionIcon ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          className="flex-row items-center gap-1"
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.96 : 1 }], opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <MaterialIcons name={actionIcon} size={18} color={MerchantColors.ink500} />
          {actionLabel ? (
            <Text style={{ color: MerchantColors.ink500, fontSize: 13 }}>
              {actionLabel}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
```

**校验字体可用性：**

```bash
grep -n "NotoSerifSC" src/app/_layout.tsx
```
Expected: 能看到 `NotoSerifSC_700Bold` 或相近已由 `useFonts()` 预加载。若字体名不同，替换为实际已加载的名称（常见：`NotoSerifSC_600SemiBold`）。

**提交：**

```bash
git add src/components/merchant/MerchantScreenHeader.tsx
git commit -m "feat(merchant-ui): 新增 MerchantScreenHeader 衬线大标题

背景：v4.4.0 列表页要用衬线 32pt 做页面级大标题（见设计稿 §3.1）。
各页面都自己拼太散，抽一个组件统一。

改动：
- 左侧 Noto Serif SC 32pt 粗体标题
- 右侧可选 action（icon + label），用于"⟳ 刷新"等高频入口
- 按压 scale 0.96 + opacity 0.8 的通用反馈，不单独动画
- 颜色走 MerchantColors.ink900 / ink500，不引入新 token

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5：`MerchantHeroStats` Hero 数字横排（含 count-up）

**Files:**
- Create: `src/components/merchant/MerchantHeroStats.tsx`
- Create: `tests/merchantHeroStats.test.ts`（仅覆盖 count-up 纯函数）

**目标：** 在列表页顶部展示 2~4 个大号数字（如"待发货 3 · 进行中 18 · 已完成 5"）；数字变化时做 300ms count-up 动画，强化"实时"感。

**Step 1：count-up 纯函数 + 测试**

抽出"给定起点、终点、进度 p(0~1) 返回当前数值"的纯函数，便于单测。

`src/components/merchant/MerchantHeroStats.tsx` 顶部：

```ts
export function interpolateCount(from: number, to: number, progress: number): number {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  // 整数展示用 round，避免 47.3 这类中间值闪跳
  return Math.round(from + (to - from) * progress);
}
```

`tests/merchantHeroStats.test.ts`：

```ts
import assert from "node:assert/strict";
import { runCase } from "./testHarness";
import { interpolateCount } from "@/components/merchant/MerchantHeroStats";

export async function runMerchantHeroStatsTests() {
  console.log("[Suite] merchantHeroStats");

  await runCase("progress=0 返回 from", () => {
    assert.equal(interpolateCount(10, 20, 0), 10);
  });
  await runCase("progress=1 返回 to", () => {
    assert.equal(interpolateCount(10, 20, 1), 20);
  });
  await runCase("progress=0.5 居中取整", () => {
    assert.equal(interpolateCount(10, 20, 0.5), 15);
  });
  await runCase("负向变化也支持", () => {
    assert.equal(interpolateCount(20, 10, 0.5), 15);
  });
  await runCase("超范围 progress 裁剪", () => {
    assert.equal(interpolateCount(10, 20, -0.5), 10);
    assert.equal(interpolateCount(10, 20, 1.5), 20);
  });
}
```

挂到 `tests/run-tests.ts`。Run: `npm run test`，Expected: FAIL（组件文件还没有 export）。

**Step 2：实现组件**

```tsx
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";

export function interpolateCount(from: number, to: number, progress: number): number {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  return Math.round(from + (to - from) * progress);
}

const COUNT_UP_DURATION_MS = 300;
const FRAME_MS = 16; // 约 60fps，满足 count-up 精度

// 单元格 hook：value 变化时触发 count-up；无变化时直接返回当前值。
function useCountUp(value: number) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const from = display;
    const to = value;
    if (from === to) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = (Date.now() - start) / COUNT_UP_DURATION_MS;
      setDisplay(interpolateCount(from, to, progress));
      if (progress >= 1) clearInterval(timer);
    }, FRAME_MS);
    return () => clearInterval(timer);
    // 仅依赖目标值，避免 display 变化引起循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

export interface HeroStatItem {
  value: number;
  label: string;
  /** 可点：用于"低库存"等支持直达筛选的场景。 */
  onPress?: () => void;
  /** 可选：强调色（如"待发货"用 statusWait）。 */
  accent?: string;
}

interface Props {
  items: HeroStatItem[];
}

// N 列等宽 Hero 数字横排。2~4 自适应；超过 4 个请拆分到下一行。
export function MerchantHeroStats({ items }: Props) {
  return (
    <View className="flex-row px-5 py-3 gap-6">
      {items.map((item, index) => (
        <HeroCell key={`${item.label}-${index}`} item={item} />
      ))}
    </View>
  );
}

function HeroCell({ item }: { item: HeroStatItem }) {
  const display = useCountUp(item.value);
  const content = (
    <View className="flex-1">
      <Text
        style={{
          color: item.accent ?? MerchantColors.ink900,
          fontFamily: "NotoSerifSC_700Bold",
          fontSize: 32,
          lineHeight: 36,
          fontVariant: ["tabular-nums"],
        }}
      >
        {display}
      </Text>
      <Text
        style={{
          color: MerchantColors.ink500,
          fontSize: 11,
          letterSpacing: 0.8,
          marginTop: 4,
        }}
      >
        {item.label}
      </Text>
    </View>
  );
  return item.onPress ? (
    <Pressable onPress={item.onPress} className="flex-1">
      {content}
    </Pressable>
  ) : (
    content
  );
}
```

Run: `npm run test`，Expected: 5/5 PASS；`npm run typecheck`，Expected: PASS。

**Step 3：提交**

```bash
git add src/components/merchant/MerchantHeroStats.tsx tests/merchantHeroStats.test.ts tests/run-tests.ts
git commit -m "feat(merchant-ui): 新增 MerchantHeroStats Hero 数字横排

背景：v4.4.0 列表页顶部露出 2~4 个关键数字（见设计稿 §3.1 / §3.3）。
为强化'实时'感，数字变化走 300ms count-up。

改动：
- interpolateCount(from, to, progress) 纯函数：裁剪 progress [0,1]，
  整数取整避免中间值闪跳
- useCountUp 内部 setInterval 16ms 节拍驱动，目标值变化时重启定时器
- 数字用 Noto Serif SC 32pt + tabular-nums；可选 accent 色给'待办'类强调
- 可选 onPress 支持直达筛选场景（如'低库存'点击跳筛选 chips）
- 5 个单测覆盖 progress 边界与方向

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6：`MerchantStatusBadge` 语义徽标（含呼吸）

**Files:**
- Create: `src/components/merchant/MerchantStatusBadge.tsx`

**目标：** 把散落在各卡片/详情页的"状态文字"统一成方形徽标；针对"待办"类（`待发货` / `待审核`）加 2 秒一次的呼吸 opacity，提示"有事要处理"。

**实现：**

```tsx
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { MerchantColors } from "@/constants/MerchantColors";

export type MerchantStatusTone = "wait" | "go" | "done" | "stop";

const TONE_COLOR: Record<MerchantStatusTone, string> = {
  wait: MerchantColors.statusWait,
  go:   MerchantColors.statusGo,
  done: MerchantColors.statusDone,
  stop: MerchantColors.statusStop,
};

interface Props {
  tone: MerchantStatusTone;
  label: string;
  /** 待办类默认 true，其它静态。显式传 false 可强制关掉呼吸（如详情页大徽标）。 */
  breathing?: boolean;
  size?: "sm" | "md";
}

// 语义状态徽标。小圆角方形（radius 6），填充底 + 反白字。
// 呼吸动效由 breathing 控制：wait 态默认打开，其它静态。
export function MerchantStatusBadge({ tone, label, breathing, size = "sm" }: Props) {
  const defaultBreathing = tone === "wait";
  const enabled = breathing ?? defaultBreathing;

  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    // 2 秒一个循环：1 → 0.7 → 1
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000 }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [enabled, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const padX = size === "sm" ? 8 : 12;
  const padY = size === "sm" ? 3 : 5;
  const fontSize = size === "sm" ? 11 : 13;

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          backgroundColor: TONE_COLOR[tone],
          borderRadius: 6,
          paddingHorizontal: padX,
          paddingVertical: padY,
          alignSelf: "flex-start",
        },
      ]}
    >
      <Text
        style={{
          color: "#fff",
          fontSize,
          fontWeight: "600",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
```

**Step 1：验证**

Run: `npm run typecheck && npm run lint`。Expected: PASS。

**Step 2：提交**

```bash
git add src/components/merchant/MerchantStatusBadge.tsx
git commit -m "feat(merchant-ui): 新增 MerchantStatusBadge 语义状态徽标

背景：v4.4.0 把状态从现有'小字 paid'升级为带色块徽标（见设计稿 §2.1 /
§5.2）。琥珀=待办、茶青=进行、墨灰=已完成、朱砂=失败/拒绝。

改动：
- 4 种 tone 对应 MerchantColors.status*
- sm/md 两种尺寸；圆角 6、反白字、letterSpacing 0.4
- 呼吸 opacity 1↔0.7 每 2 秒一次，使用 Reanimated shared value
  + withRepeat 原生驱动，性能友好
- wait 态默认呼吸打开，其它默认关闭；可通过 breathing prop 强制覆盖

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7：`MerchantBentoBlock` / `MerchantTimeline` / `MerchantStickyActions`

三个小型组件一次落地（都是无状态纯 UI，不值得各自独立 Task）。

**Files:**
- Create: `src/components/merchant/MerchantBentoBlock.tsx`
- Create: `src/components/merchant/MerchantTimeline.tsx`
- Create: `src/components/merchant/MerchantStickyActions.tsx`

### 7.1 `MerchantBentoBlock`

```tsx
import { ReactNode } from "react";
import { Text, View, ViewStyle } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";

interface Props {
  title?: string;
  /** 右上角小标（如"2 件 · ¥398"）。 */
  summary?: string;
  children: ReactNode;
  style?: ViewStyle;
}

// 详情页 Bento 块容器：纸白底 + 1px 米线 + 可选标题/汇总。
// 每块职责单一，内容由 children 决定；不做自身业务逻辑。
export function MerchantBentoBlock({ title, summary, children, style }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: MerchantColors.paper,
          borderColor: MerchantColors.line,
          borderWidth: 1,
          borderRadius: 20,
          padding: 16,
          gap: 12,
        },
        style,
      ]}
    >
      {(title || summary) ? (
        <View className="flex-row items-end justify-between">
          {title ? (
            <Text
              style={{
                color: MerchantColors.ink900,
                fontFamily: "Manrope_700Bold",
                fontSize: 14,
                letterSpacing: 0.4,
              }}
            >
              {title}
            </Text>
          ) : <View />}
          {summary ? (
            <Text style={{ color: MerchantColors.ink500, fontSize: 11 }}>
              {summary}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
```

### 7.2 `MerchantTimeline`

```tsx
import { Text, View } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";

export interface TimelineStep {
  /** 形如 "11:32" 或 "04-17 11:32"；为空时展示 "--"。 */
  time: string | null;
  label: string;
  /** 是否已完成。已完成实心点 ●；未到空心 ○。 */
  done: boolean;
}

interface Props {
  steps: TimelineStep[];
}

// 详情页状态时间线：下单 → 已支付 → 发货 → 送达。
// 已完成的节点实心茶青点 + 深字；未到的空心米线点 + 灰字。
export function MerchantTimeline({ steps }: Props) {
  return (
    <View className="gap-3">
      {steps.map((step, i) => (
        <View key={`${step.label}-${i}`} className="flex-row items-center gap-3">
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: step.done ? MerchantColors.statusGo : "transparent",
              borderWidth: 1,
              borderColor: step.done ? MerchantColors.statusGo : MerchantColors.line,
            }}
          />
          <Text
            style={{
              color: step.done ? MerchantColors.ink900 : MerchantColors.ink500,
              fontSize: 13,
              fontVariant: ["tabular-nums"],
              width: 96,
            }}
          >
            {step.time ?? "--"}
          </Text>
          <Text
            style={{
              color: step.done ? MerchantColors.ink900 : MerchantColors.ink500,
              fontSize: 13,
            }}
          >
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

### 7.3 `MerchantStickyActions`

```tsx
import { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MerchantColors } from "@/constants/MerchantColors";

interface Props {
  children: ReactNode;
}

// 详情页底部 sticky 操作条：SafeArea inset 兜底；不自绘按钮，交给调用方自由组合。
export function MerchantStickyActions({ children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 12 + insets.bottom,
        backgroundColor: MerchantColors.paper,
        borderTopColor: MerchantColors.line,
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}
```

**Step 1：验证 + 提交**

```bash
npm run typecheck
git add src/components/merchant/MerchantBentoBlock.tsx \
        src/components/merchant/MerchantTimeline.tsx \
        src/components/merchant/MerchantStickyActions.tsx
git commit -m "feat(merchant-ui): 新增 BentoBlock / Timeline / StickyActions

背景：v4.4.0 详情页走 Bento 重排 + 状态时间线 + 底部 sticky 操作条
（见设计稿 §4）。三个组件职责单一、无状态，一并落地。

改动：
- MerchantBentoBlock 纸白底 + 1px 米线 + 可选标题/汇总 slot
- MerchantTimeline 已完成实心茶青点 / 未到空心米线点；tabular-nums 对齐时间
- MerchantStickyActions 绝对定位底部、SafeArea inset 兜底、按钮由调用方决定

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8：既有卡片组件视觉精细化（3 个卡片 + TopTabs + FilterBar）

**Files:**
- Modify: `src/components/merchant/MerchantOrderCard.tsx`
- Modify: `src/components/merchant/MerchantAfterSaleCard.tsx`
- Modify: `src/components/merchant/MerchantProductCard.tsx`
- Modify: `src/components/merchant/MerchantOrderFilterBar.tsx`
- Modify: `src/components/merchant/MerchantTopTabs.tsx`

**目标：** 就地改视觉，不动交互与 props，降低重排页面时的变量。

### 8.1 改造清单

| 组件 | 改造点 |
|---|---|
| `MerchantOrderCard` | 背景 `paper` + 1px `line`；删除阴影；状态从文字改成 `<MerchantStatusBadge>`；新增"商品缩略"一行（order.order_items map 到 "名称 × 数量 · 名称 × 数量"，最多拼 3 个后 "…"） |
| `MerchantAfterSaleCard` | 同上背景；状态改 `MerchantStatusBadge`（status→tone 映射：submitted/pending_review/auto_approved → wait；approved/refunding → go；rejected/cancelled → stop；refunded → done） |
| `MerchantProductCard` | 同上背景；低库存标识从"⚠️ 低库存"改为右上 `<MerchantStatusBadge tone="wait" label="低库存">` |
| `MerchantOrderFilterBar` | chips 高度从默认改 28pt；未选中用 `borderWidth: 1` + `borderColor: MerchantColors.line` + 透明底；搜索框圆角 12 |
| `MerchantTopTabs` | pill 高度 28pt；非激活态走米线描边；字号从 12 → 13 |

### 8.2 状态 → tone 映射函数（复用）

在 `src/lib/merchantFilters.ts` 末尾追加（因为是 UI 纯派生，跟筛选在同一关注点内）：

```ts
import type { MerchantStatusTone } from "@/components/merchant/MerchantStatusBadge";

export function orderStatusToTone(status: string): MerchantStatusTone {
  if (status === "paid") return "wait";
  if (status === "shipping") return "go";
  if (status === "delivered") return "done";
  if (status === "cancelled") return "stop";
  return "done";
}

export function afterSaleStatusToTone(status: string): MerchantStatusTone {
  if (["submitted", "pending_review", "auto_approved"].includes(status)) return "wait";
  if (["approved", "refunding"].includes(status)) return "go";
  if (status === "refunded") return "done";
  if (["rejected", "cancelled"].includes(status)) return "stop";
  return "done";
}
```

**Step 1：每改一个组件后**

Run: `npm run typecheck`（每改一个就跑一次，避免回归）。

**Step 2：提交（一次到位）**

```bash
git add src/components/merchant/MerchantOrderCard.tsx \
        src/components/merchant/MerchantAfterSaleCard.tsx \
        src/components/merchant/MerchantProductCard.tsx \
        src/components/merchant/MerchantOrderFilterBar.tsx \
        src/components/merchant/MerchantTopTabs.tsx \
        src/lib/merchantFilters.ts
git commit -m "refactor(merchant-ui): 既有卡片 / 筛选 / Top Tabs 视觉精细化

背景：v4.4.0 视觉语言落到 5 个既有组件（见设计稿 §6.2）；不动 props，
仅改视觉，便于后续页面重排作变量更少。

改动：
- 3 个卡片统一改 MerchantColors.paper + 1px line；状态文字替换为
  MerchantStatusBadge；低库存也走徽标
- MerchantOrderCard 新增'商品缩略行'（最多拼 3 个 order_items）
- FilterBar chips 高度 28pt、未选中改米线描边、搜索圆角 12
- TopTabs pill 高度 28pt，非激活态米线描边，字号 12→13
- src/lib/merchantFilters.ts 新增 orderStatusToTone / afterSaleStatusToTone
  两个纯派生函数，避免各卡片重复映射

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9：弹窗组件圆角 + Alert → Toast 全量迁移

**Files:**
- Modify: `src/components/merchant/ShipOrderDialog.tsx`
- Modify: `src/components/merchant/AfterSaleActionSheet.tsx`
- Modify: `src/app/merchant/orders/[id].tsx`
- Modify: `src/app/merchant/after-sale/[id].tsx`
- Modify: `src/app/merchant/products/[id].tsx`
- Modify: `src/app/merchant/staff.tsx`

**目标：**
1. Dialog/ActionSheet 输入圆角统一 12，字号 14
2. 把所有非破坏性 `Alert.alert()` 改成 `pushMerchantToast()`
3. 破坏性 `showConfirm` 保持不变

### 9.1 替换规则

```
Alert.alert("发货成功")
  → pushMerchantToast({ kind: "success", title: "发货成功" })

Alert.alert("发货失败", errMessage)
  → pushMerchantToast({ kind: "error", title: "发货失败", detail: errMessage })

showConfirm(...) 保留原样
```

### 9.2 逐文件迁移点

| 文件 | Alert 调用位置 | 替换为 |
|---|---|---|
| `orders/[id].tsx` | `handleShip` 成功/失败 | success/error Toast |
| `orders/[id].tsx` | `handleClose` 失败 | error Toast |
| `after-sale/[id].tsx` | `handleSubmit` 成功/失败 | success/error Toast |
| `products/[id].tsx` | `handleSave` 成功/失败 | success/error Toast |
| `products/[id].tsx` | `handleStock` 失败 | error Toast（成功由 StockAdjustPanel 自弹 Alert，改为 Toast） |
| `components/merchant/StockAdjustPanel.tsx` | 成功 `Alert.alert("库存已更新")` | 改成调 pushMerchantToast；同时 import |
| `staff.tsx` | `call()` 成功/失败 | success/error Toast |

### 9.3 Dialog 视觉微调

`ShipOrderDialog` / `AfterSaleActionSheet`：
- 输入框 `borderRadius: 12`
- 输入框 `paddingVertical: 10`（原 8）
- 字号 14（原默认）
- 取消 / 确认按钮位置与层级保持不变

**Step 1：逐文件替换**

建议顺序：`StockAdjustPanel` → 4 个页面 → 2 个 Dialog。每个文件修改后跑 `npm run typecheck`。

**Step 2：提交**

```bash
git add src/components/merchant/ShipOrderDialog.tsx \
        src/components/merchant/AfterSaleActionSheet.tsx \
        src/components/merchant/StockAdjustPanel.tsx \
        src/app/merchant/orders/\[id\].tsx \
        src/app/merchant/after-sale/\[id\].tsx \
        src/app/merchant/products/\[id\].tsx \
        src/app/merchant/staff.tsx
git commit -m "refactor(merchant-ui): Alert.alert → Toast 全量迁移 + 弹窗圆角统一

背景：v4.4.0 用 Toast 替代 Alert.alert（见设计稿 §5.3）。破坏性操作
（关闭订单 / 撤销员工）继续走 showConfirm 双确认。

改动：
- orders/[id] / after-sale/[id] / products/[id] / staff 共 4 个页面，
  所有非破坏性 Alert 改为 pushMerchantToast（成功 success / 失败 error）
- StockAdjustPanel 成功反馈同步迁移，保持提交失败不清空输入的原行为
- ShipOrderDialog / AfterSaleActionSheet 输入框圆角 12、上下内边距 10、
  字号 14；按钮层级不动

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10：订单履约页重排（列表 + 详情）

**Files:**
- Rewrite: `src/app/merchant/orders/index.tsx`
- Rewrite: `src/app/merchant/orders/[id].tsx`

### 10.1 列表页（`orders/index.tsx`）

结构：`AppHeader` → `MerchantTopTabs` → `MerchantScreenHeader "订单履约"` → `MerchantHeroStats` → `MerchantOrderFilterBar` → `FlatList`。

Hero 数字派生：

```ts
const heroItems = useMemo(() => {
  const count = (pred: (o: Order) => boolean) => orders.filter(pred).length;
  return [
    { value: count((o) => o.status === "paid"),      label: "待发货", accent: MerchantColors.statusWait },
    { value: count((o) => o.status === "shipping"),  label: "进行中", accent: MerchantColors.statusGo },
    { value: count((o) => o.status === "delivered"), label: "已完成" },
  ];
}, [orders]);
```

FlatList 入场动效：`renderItem` 包一层 `Animated.View entering={FadeInDown.delay(Math.min(index, 5) * 40).duration(200)}`。

### 10.2 详情页（`orders/[id].tsx`）

结构：
```
AppHeader
ScrollView {
  身份段：订单号（meta）+ 状态徽标（md 大号） + 衬线大字"待发货" + 金额 + 下单时间
  BentoBlock "收件" ← 一半宽
  BentoBlock "物流" ← 一半宽（View row gap 12）
  BentoBlock "商品" ← 缩略图 + 名称 + 数量 + 单价（order_items map）
  BentoBlock "时间线" ← MerchantTimeline
}
MerchantStickyActions {
  关闭订单 按钮（条件：非终态）
  发货 按钮（条件：paid）
}
```

时间线数据派生：

```ts
const timelineSteps: TimelineStep[] = [
  { time: fmt(order.created_at), label: "下单", done: true },
  { time: order.paid_at ? fmt(order.paid_at) : null, label: "已支付", done: !!order.paid_at },
  { time: order.shipped_at ? fmt(order.shipped_at) : null, label: "已发货", done: !!order.shipped_at },
  { time: order.delivered_at ? fmt(order.delivered_at) : null, label: "已签收", done: !!order.delivered_at },
];
```

`fmt`：`new Date(v).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })`。

**ScrollView `contentContainerStyle.paddingBottom` 必须预留 sticky 操作条高度**（约 72px + SafeArea bottom），否则最后一块会被遮。

**Step 1：验证**

Run: `npm run check`，Expected: 全绿。手动真机验证：打开一个 paid 订单 → 检查 Bento 排版、时间线、sticky 按钮位置。

**Step 2：提交**

```bash
git add src/app/merchant/orders/index.tsx src/app/merchant/orders/\[id\].tsx
git commit -m "feat(merchant-ui): 订单履约列表/详情按 Editorial × Bento 重排

背景：v4.4.0 视觉重构第 1 个业务模块（见设计稿 §3 / §4）。

改动：
- orders/index：ScreenHeader 衬线大标题 + HeroStats 三数字（待发货 /
  进行中 / 已完成），卡片保持之前 Task 8 精细化后的版本。FlatList 前 6
  项做 FadeInDown 入场，stagger 40ms。
- orders/[id]：重排为身份段 + 4 个 BentoBlock（收件 / 物流 / 商品 /
  时间线） + StickyActions 底部操作条。Timeline 派生自 orders.created_at
  / paid_at / shipped_at / delivered_at，零后端改动。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11：售后处理页重排（列表 + 详情）

**Files:**
- Rewrite: `src/app/merchant/after-sale/index.tsx`
- Rewrite: `src/app/merchant/after-sale/[id].tsx`

### 11.1 列表页

结构与订单列表一致。Hero 三数字：

```ts
const pendingSet = ["submitted", "pending_review", "auto_approved"];
const heroItems = [
  { value: afterSales.filter(r => pendingSet.includes(r.status)).length, label: "待审核", accent: MerchantColors.statusWait },
  { value: afterSales.filter(r => r.status === "approved").length,       label: "已同意", accent: MerchantColors.statusGo },
  { value: afterSales.filter(r => r.status === "refunded").length,       label: "已完成" },
];
```

### 11.2 详情页

```
身份段：申请 ID（meta）+ 大号状态徽标 + 衬线"待审核" + 诉求金额 + 提交时间
BentoBlock "原因"：reason_code + reason_text
BentoBlock "订单关联"：order_id（可点跳 /merchant/orders/[id]）+ 订单摘要
BentoBlock "商家备注"：audit_note / refund_txn_id（已有时显示）
StickyActions：
  pending 态 → [ 拒绝 ] [ 同意 ]
  approved/refunding → [ 标记已打款 ]
  其它 → 无
```

凭证图片（`after_sale_evidences`）**本次不实现**（MVP 设计里也没要求），有则只显示 "含 N 张凭证 · 去 Supabase 查看" 占位文本。

**Step 1：验证 + 提交**

```bash
npm run check
git add src/app/merchant/after-sale/index.tsx src/app/merchant/after-sale/\[id\].tsx
git commit -m "feat(merchant-ui): 售后处理列表/详情重排

背景：v4.4.0 第 2 个业务模块。

改动：
- after-sale/index：ScreenHeader + HeroStats（待审核 / 已同意 / 已完成），
  复用筛选 chips 与卡片。
- after-sale/[id]：身份段 + 3 个 BentoBlock（原因 / 订单关联 / 商家备注）
  + StickyActions。拒绝/同意/打款按钮条件渲染。凭证占位展示，详细查阅
  Supabase Dashboard（MVP 范围不含凭证预览）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12：商品与库存页重排（列表 + 详情）

**Files:**
- Rewrite: `src/app/merchant/products/index.tsx`
- Rewrite: `src/app/merchant/products/[id].tsx`

### 12.1 列表页

Hero 四数字（本模块是唯一 4 个的特殊情况，允许横排自适应）：

```ts
const heroItems = [
  { value: products.filter(p => p.is_active === true).length,                          label: "在架" },
  { value: products.filter(p => p.is_active === false).length,                         label: "下架" },
  {
    value: products.filter(p => (p.stock ?? 0) < LOW_STOCK_THRESHOLD).length,
    label: "低库存",
    accent: MerchantColors.statusWait,
    onPress: () => setFilter({ scope: "low_stock" }), // 点击直达筛选
  },
  { value: products.length, label: "全部" },
];
```

### 12.2 详情页

```
身份段：商品名 + 上/下架徽标 + 大号库存数字（Noto Serif SC 32pt）
BentoBlock "基本信息"：name / price / description / 上下架 Switch + 保存按钮
BentoBlock "库存调整"：StockAdjustPanel（Task 9 已改成 Toast 反馈）
```

**Step 1：验证 + 提交**

```bash
npm run check
git add src/app/merchant/products/index.tsx src/app/merchant/products/\[id\].tsx
git commit -m "feat(merchant-ui): 商品列表/详情重排

背景：v4.4.0 第 3 个业务模块；本模块是唯一 4 个 Hero 数字的场景（在架 /
下架 / 低库存 / 全部），低库存可直点筛选。

改动：
- products/index：HeroStats 4 数字，低库存 accent=statusWait 且 onPress
  直达 low_stock 筛选，解放'点 chip 再看列表'两步。
- products/[id]：身份段大号库存数字 + 两个 BentoBlock（基本信息 /
  库存调整）；保存按钮并入 BentoBlock 内，StickyActions 本模块不用。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13：员工管理页 + 视觉回归 + 打 tag v4.4.0

**Files:**
- Modify: `src/app/merchant/staff.tsx`

### 13.1 员工管理页微调

- 说明段包在 `MerchantBentoBlock title="使用说明"` 里
- 输入 + 三按钮包在 `MerchantBentoBlock title="授权动作"` 里
- 输入框圆角 12（与其它 Dialog 对齐）
- 按钮按压 scale 0.98，与全局反馈一致

### 13.2 手动视觉回归清单

以 admin 账号跑一遍：

1. ✅ 从「我的」页入口卡片进入 → 顶部 Tab 四项可见（订单/售后/商品/员工）
2. ✅ 订单列表：3 数字 Hero 与数据一致；chips 切换有 200ms 色过渡；下拉刷新重放入场
3. ✅ 订单详情：Bento 四块视觉一致；时间线点位正确；sticky 按钮不被遮；发货成功 Toast 顶部弹出 3 秒自动消失
4. ✅ 售后列表/详情：状态徽标色与枚举映射正确；待审核徽标有呼吸；三按钮条件渲染符合 status
5. ✅ 商品列表：Hero 四数字；点「低库存」直达筛选
6. ✅ 商品详情：基本信息保存成功 Toast；库存调整成功 Toast
7. ✅ 员工页：输入 user_id → 设为 staff / admin / 撤销 三按钮反馈都走 Toast
8. ✅ 关闭订单 / 撤销员工 等破坏性动作仍走 showConfirm（**未被误迁成 Toast**）
9. ✅ 普通顾客账号：「我的」页**无**商家入口；直接访问 `/merchant/orders` 被重定向回首页

### 13.3 最终自检

```bash
npm run check
```
Expected: lint + typecheck + test 全绿。

### 13.4 合并 + 打 tag

```bash
git add src/app/merchant/staff.tsx
git commit -m "feat(merchant-ui): 员工管理页接入 Bento 分块

背景：v4.4.0 视觉重构的最后一个页面。保持功能不变，只套用设计语言。

改动：
- 说明段与授权动作各包一个 MerchantBentoBlock，与其它详情页统一
- 输入框圆角 12 与 Dialog 对齐；按钮按压反馈保留
- Alert 早在 Task 9 迁到 Toast，此处无额外改动

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

# 合并主干
git checkout master
git merge feat/merchant-ui-redesign --no-ff -m "Merge branch 'feat/merchant-ui-redesign': v4.4.0 商家端 UI 重设计

详情见：
- docs/plans/2026-04-17-merchant-ui-redesign-design.md
- docs/plans/2026-04-17-merchant-ui-redesign-plan.md"

# 推远程
git push origin master

# 打 tag
git tag -a v4.4.0 -m "v4.4.0 发布：商家端 UI Editorial × Bento 重设计

视觉 / 交互：
- 新增 MerchantColors 语义色板（ink/paper/line + wait/go/done/stop）
- 新增 5 个组件：ScreenHeader / HeroStats / StatusBadge / BentoBlock
  / Timeline / StickyActions
- 新增 Toast 系统（merchantToastStore + MerchantToast）替代 Alert
- 既有 5 个组件（3 卡片 + TopTabs + FilterBar）视觉精细化
- 7 个页面重排：Editorial 列表 + Bento 详情 + Sticky 操作条

动效：
- 列表项 FadeInDown 入场（前 6 项 40ms stagger）
- Hero 数字 count-up 300ms
- 待办徽标 2 秒呼吸 opacity

YAGNI：
- 不新增 Dashboard、不改后端、不做深色模式、不做图表与新建商品"

git push origin v4.4.0
```

---

## 验收记录

> 实施时在此追加每次回归结果，格式：`YYYY-MM-DD · 验收人 · 场景 · 结果`。

- 待填

---

## 完成后（V5 排期建议，明确 *不在本计划范围内*）

- 商家端 Dashboard（销售曲线 / 转化漏斗）
- 新建商品 / 图片上传 / SKU 多规格
- 售后凭证图片预览
- 深色模式（含 C 端联动）
- 国际化 / 无障碍 / 大字体适配

