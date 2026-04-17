import { logWarn } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

// 冷启动 / RPC 失败时的兜底热词：覆盖当前目录的主要茶类，避免首页出现空区域。
export const FALLBACK_HOT_KEYWORDS: readonly string[] = [
  "明前龙井",
  "春茶上新",
  "岩茶推荐",
  "普洱老生茶",
  "大红袍",
  "盖碗套装",
  "白茶饼",
  "紫砂壶开壶",
];

// 拉取热词列表：优先走后端 RPC；出错就返回静态兜底，保证页面永远有东西可展示。
export async function fetchTopSearchKeywords(
  limit = 8,
): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc("get_top_search_keywords", {
      p_limit: limit,
    });

    if (error) {
      throw error;
    }

    // Supabase rpc 返回 setof text 时，data 会是 `{ get_top_search_keywords: string }[]` 或 string[]。
    const list = Array.isArray(data)
      ? (data as unknown[]).map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (
            item &&
            typeof item === "object" &&
            "get_top_search_keywords" in item
          ) {
            const value = (item as Record<string, unknown>).get_top_search_keywords;
            return typeof value === "string" ? value : "";
          }
          return "";
        })
      : [];

    const normalized = list.filter((keyword) => keyword.length > 0);
    if (normalized.length === 0) {
      return [...FALLBACK_HOT_KEYWORDS];
    }

    return normalized;
  } catch (error) {
    logWarn("searchKeywords", "fetchTopSearchKeywords 失败", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [...FALLBACK_HOT_KEYWORDS];
  }
}

// 记录一次搜索命中：fire-and-forget。写失败只打日志，不影响搜索主流程。
export function recordSearchKeyword(keyword: string) {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return;
  }

  void supabase
    .rpc("record_search_keyword", { p_keyword: trimmed })
    .then(({ error }) => {
      if (error) {
        logWarn("searchKeywords", "recordSearchKeyword 失败", {
          keyword: trimmed,
          error: error.message,
        });
      }
    });
}
