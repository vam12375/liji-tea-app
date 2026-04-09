import "expo-sqlite/localStorage/install";
import { createClient } from "@supabase/supabase-js";
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from "react-native";

type RequiredEnvKey =
  | "EXPO_PUBLIC_SUPABASE_URL"
  | "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`缺少必需的环境变量：${key}。请检查 .env 文件配置。`);
  }

  return value;
}

const supabaseUrl = readRequiredEnv("EXPO_PUBLIC_SUPABASE_URL");
const supabaseKey = readRequiredEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: globalThis.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let autoRefreshSubscription: NativeEventSubscription | null = null;
let autoRefreshConsumerCount = 0;

function syncSupabaseAutoRefresh(state: AppStateStatus) {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
    return;
  }

  supabase.auth.stopAutoRefresh();
}

export function setupSupabaseAutoRefresh(): () => void {
  autoRefreshConsumerCount += 1;

  if (!autoRefreshSubscription) {
    syncSupabaseAutoRefresh(AppState.currentState);
    autoRefreshSubscription = AppState.addEventListener(
      "change",
      syncSupabaseAutoRefresh,
    );
  }

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    autoRefreshConsumerCount = Math.max(0, autoRefreshConsumerCount - 1);

    if (autoRefreshConsumerCount === 0) {
      autoRefreshSubscription?.remove();
      autoRefreshSubscription = null;
      supabase.auth.stopAutoRefresh();
    }
  };
}
