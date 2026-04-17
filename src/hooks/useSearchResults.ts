import { useMemo } from "react";

import type { Product } from "@/stores/productStore";
import type { TeaCategory } from "@/data/products";

// 搜索页四档价格区间：与 UI 胶囊文案一一对应。
export type SearchPriceBand = "all" | "0-100" | "100-300" | "300+";

// 搜索页四种排序模式。relevance 保留服务端返回顺序；newest 取决于 createdAt。
export type SearchSortMode =
  | "relevance"
  | "priceAsc"
  | "priceDesc"
  | "newest";

interface UseSearchResultsParams {
  baseResults: Product[];
  category: TeaCategory;
  priceBand: SearchPriceBand;
  sortMode: SearchSortMode;
}

// 判断商品价格是否落在给定区间内。区间右开左闭，保持胶囊文案直觉一致。
function matchesPriceBand(price: number, band: SearchPriceBand) {
  switch (band) {
    case "all":
      return true;
    case "0-100":
      return price < 100;
    case "100-300":
      return price >= 100 && price < 300;
    case "300+":
      return price >= 300;
    default:
      return true;
  }
}

// 搜索结果流水线：分类过滤 → 价格过滤 → 排序。
// 放在 hook 而不是组件里，避免 useMemo 依赖数组手写维护。
export function useSearchResults({
  baseResults,
  category,
  priceBand,
  sortMode,
}: UseSearchResultsParams): Product[] {
  return useMemo(() => {
    const filtered = baseResults.filter((item) => {
      if (category !== "全部" && item.category !== category) {
        return false;
      }
      if (!matchesPriceBand(item.price, priceBand)) {
        return false;
      }
      return true;
    });

    if (sortMode === "relevance") {
      return filtered;
    }

    // slice() 保留原数组，避免把输入 baseResults 也就地排序。
    const sorted = filtered.slice();
    switch (sortMode) {
      case "priceAsc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "priceDesc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        sorted.sort((a, b) => {
          const left = a.createdAt ?? "";
          const right = b.createdAt ?? "";
          // ISO 字符串直接比较即可实现按时间倒序。
          return right.localeCompare(left);
        });
        break;
      default:
        break;
    }
    return sorted;
  }, [baseResults, category, priceBand, sortMode]);
}
