import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

/**
 * 客户端崩溃 / captureError 上报器。
 *
 * 设计取舍（KISS）：
 * - 单进程单队列，线程安全由 JS 单线程保证。
 * - 批量 20 或 30 秒整点 flush；超过 100 条则丢弃最旧的，避免长时间离线吃内存。
 * - flush 失败 → 全量持久化到 AsyncStorage；下次 `initCrashReporter()` 启动时加载并重试。
 * - 内部出错只 `console.warn`，绝不回调 `captureError`，防止无限递归。
 */

export interface CrashReport {
  scope: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  appVersion?: string;
  platform?: string;
}

// 内存队列最大长度：防止长期离线时内存无限制增长。
const MAX_QUEUE = 100;
// 达到多少条立刻 flush。
const BATCH_SIZE = 20;
// 定时 flush 周期（毫秒）。
const FLUSH_INTERVAL_MS = 30 * 1000;
// 持久化到本地的 key，后续升级可加 v2 后缀做兼容。
const STORAGE_KEY = "@liji_tea/crash_reports_pending_v1";

const APP_VERSION = Constants.expoConfig?.version ?? undefined;
const PLATFORM = Platform.OS;

let queue: CrashReport[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let initialized = false;
let enabled = true;

function trimQueue() {
  if (queue.length > MAX_QUEUE) {
    queue = queue.slice(-MAX_QUEUE);
  }
}

async function loadPendingFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as CrashReport[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      // 把历史队列放到当前队列前面，保持时间顺序。
      queue = [...parsed, ...queue];
      trimQueue();
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // 本地数据破损：清掉避免阻塞，不走 captureError 以免自循环。
    console.warn("[crashReporter] 加载本地待上报队列失败，已清理。");
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }
}

async function persistToStorage(reports: CrashReport[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    console.warn("[crashReporter] 持久化本地队列失败。");
  }
}

async function flush(): Promise<void> {
  if (flushing || !enabled || queue.length === 0) {
    return;
  }

  flushing = true;
  const batch = queue.splice(0, BATCH_SIZE);

  try {
    const { error } = await supabase.functions.invoke("report-crash", {
      body: { reports: batch },
    });
    if (error) {
      throw error;
    }
  } catch {
    // 失败：放回队头并持久化，下次启动或下一轮定时再试。
    queue = [...batch, ...queue];
    trimQueue();
    await persistToStorage(queue);
  } finally {
    flushing = false;
  }
}

function scheduleTimer() {
  if (flushTimer) {
    return;
  }
  flushTimer = setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
}

/** 由 logger.captureError 调用：把一次错误入队，等 batch 或定时 flush。 */
export function pushCrashReport(
  report: Omit<CrashReport, "appVersion" | "platform">,
) {
  if (!enabled) {
    return;
  }

  queue.push({
    ...report,
    appVersion: APP_VERSION,
    platform: PLATFORM,
  });
  trimQueue();

  if (queue.length >= BATCH_SIZE) {
    void flush();
  }
}

/**
 * 在根布局尽早调用，加载历史队列 + 启动定时 flush。
 * 传入 `{ enabled: false }` 可整体禁用（例如 E2E 测试环境）。
 */
export async function initCrashReporter(
  options: { enabled?: boolean } = {},
): Promise<void> {
  if (options.enabled === false) {
    enabled = false;
    return;
  }
  if (initialized) {
    return;
  }
  initialized = true;

  await loadPendingFromStorage();
  scheduleTimer();

  // 启动时如果已有积压（刚 load 出来）就立刻 flush 一次。
  if (queue.length > 0) {
    void flush();
  }
}

/** 测试或应用退到后台时可以显式 flush。 */
export async function flushCrashReporter(): Promise<void> {
  await flush();
}

/** 仅测试用：重置内部状态。 */
export function __resetCrashReporterForTests(): void {
  queue = [];
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushing = false;
  initialized = false;
  enabled = true;
}
