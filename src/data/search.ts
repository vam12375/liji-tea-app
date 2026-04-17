// 搜索页早期的硬编码数据：当前保留仅为向后兼容。
// 热词请改为通过 @/lib/searchKeywords 的 fetchTopSearchKeywords 拉取；
// 静态兜底集中维护在 searchKeywords.FALLBACK_HOT_KEYWORDS，不要复制两份。

/** @deprecated 改走 AsyncStorage，此默认值已不再被 search.tsx 使用。 */
export const defaultSearchHistory = ["龙井", "白毫银针", "冲泡方法", "送礼推荐"];

/** @deprecated 请改用 searchKeywords.FALLBACK_HOT_KEYWORDS / fetchTopSearchKeywords。 */
export const hotSearches = [
  "明前龙井", "春茶上新", "岩茶推荐", "普洱老生茶",
  "大红袍", "盖碗套装", "白茶饼", "紫砂壶开壶",
];
