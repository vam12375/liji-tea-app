import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

import { PendingReviewCard } from "@/components/customer/reviews/PendingReviewCard";
import { ReviewedReviewCard } from "@/components/customer/reviews/ReviewedReviewCard";
import {
  EMPTY_REVIEW_DRAFT,
  type ReviewDraft,
} from "@/components/customer/reviews/types";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { routes } from "@/lib/routes";
import { showModal } from "@/stores/modalStore";
import { useReviewStore } from "@/stores/reviewStore";
import { useUserStore } from "@/stores/userStore";

/** 我的评价页顶部标签：区分待评价与已评价两个主视图。 */
const TABS = ["待评价", "已评价"] as const;
/** 已评价列表的快捷筛选项。 */
const REVIEW_FILTERS = ["最新", "好评", "晒图"] as const;
type ReviewTab = (typeof TABS)[number];
type ReviewFilter = (typeof REVIEW_FILTERS)[number];

export default function MyReviewsScreen() {
  const { productId, initialTab } = useLocalSearchParams<{
    productId?: string;
    initialTab?: ReviewTab;
  }>();
  const session = useUserStore((state) => state.session);
  const pendingReviewItems = useReviewStore((state) => state.pendingReviewItems);
  const myReviews = useReviewStore((state) => state.myReviews);
  const loading = useReviewStore((state) => state.loading);
  const submitting = useReviewStore((state) => state.submitting);
  const fetchPendingReviewItems = useReviewStore(
    (state) => state.fetchPendingReviewItems,
  );
  const fetchMyReviews = useReviewStore((state) => state.fetchMyReviews);
  const submitReview = useReviewStore((state) => state.submitReview);
  const updateReview = useReviewStore((state) => state.updateReview);
  const deleteReview = useReviewStore((state) => state.deleteReview);

  const [activeTab, setActiveTab] = useState<ReviewTab>(
    initialTab === "已评价" ? "已评价" : "待评价",
  );
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("最新");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  // 草稿按 orderItem.id 或 review.id 作为 key；待评价与编辑态共用，互不冲突。
  const [draftById, setDraftById] = useState<Record<string, ReviewDraft>>({});

  /** 登录后并行加载待评价列表与我的历史评价。 */
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    void Promise.all([fetchPendingReviewItems(), fetchMyReviews()]);
  }, [fetchMyReviews, fetchPendingReviewItems, session?.user?.id]);

  useEffect(() => {
    if (initialTab === "已评价") {
      setActiveTab("已评价");
    }
  }, [initialTab]);

  /**
   * 已评价列表支持按商品范围与筛选项二次过滤。
   * 如果从商品详情进入，会优先只展示当前商品的评价。
   */
  const filteredReviews = useMemo(() => {
    const scopedReviews = productId
      ? myReviews.filter((item) => item.product?.id === productId)
      : myReviews;

    const byCreatedAtDesc = (a: { created_at: string }, b: { created_at: string }) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    switch (reviewFilter) {
      case "好评":
        return scopedReviews
          .filter((item) => item.rating >= 4)
          .sort(byCreatedAtDesc);
      case "晒图":
        return scopedReviews
          .filter((item) => item.images.length > 0)
          .sort(byCreatedAtDesc);
      case "最新":
      default:
        return [...scopedReviews].sort(byCreatedAtDesc);
    }
  }, [myReviews, productId, reviewFilter]);

  /** 根据当前主标签决定列表数据源。 */
  const currentList = useMemo(
    () => (activeTab === "待评价" ? pendingReviewItems : filteredReviews),
    [activeTab, filteredReviews, pendingReviewItems],
  );

  /** 局部合并草稿，父层只需把 key + patch 传进来。 */
  const patchDraft = (key: string, base: ReviewDraft, patch: Partial<ReviewDraft>) => {
    setDraftById((state) => ({ ...state, [key]: { ...base, ...patch } }));
  };

  if (!session) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="我的评价" />
        <ScreenState
          variant="empty"
          title="登录后查看评价"
          description="订单完成后可在这里进行评价、查看历史晒单。"
          icon="rate-review"
          actionLabel="去登录"
          onAction={() =>
            showModal(
              "请先登录",
              "登录后即可查看待评价商品与历史评价。",
              "info",
            )
          }
        />
      </View>
    );
  }

  const userId = session.user.id;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="我的评价" />

      <View className="px-4 pt-3 pb-2 gap-3">
        <View className="flex-row bg-surface-container-low rounded-full p-1">
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 rounded-full py-2.5 items-center ${active ? "bg-primary-container" : ""}`}
              >
                <Text
                  className={
                    active
                      ? "text-on-primary font-medium"
                      : "text-on-surface-variant"
                  }
                >
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === "已评价" ? (
          <View className="flex-row gap-2">
            {REVIEW_FILTERS.map((filter) => {
              const active = reviewFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setReviewFilter(filter)}
                  className={`px-3 py-1.5 rounded-full border ${
                    active
                      ? "bg-primary-container border-primary/20"
                      : "bg-surface-container-low border-outline-variant/20"
                  }`}
                >
                  <Text
                    className={
                      active
                        ? "text-on-primary text-xs font-medium"
                        : "text-on-surface-variant text-xs"
                    }
                  >
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {loading && currentList.length === 0 ? (
        <ScreenState variant="loading" title="正在加载评价数据..." />
      ) : activeTab === "待评价" ? (
        <FlatList
          data={pendingReviewItems}
          keyExtractor={(item) => item.orderItem.id}
          contentContainerClassName="px-4 pb-10 gap-4"
          renderItem={({ item }) => {
            const key = item.orderItem.id;
            const draft = draftById[key] ?? EMPTY_REVIEW_DRAFT;
            return (
              <PendingReviewCard
                item={item}
                draft={draft}
                submitting={submitting}
                userId={userId}
                onDraftChange={(patch) => patchDraft(key, draft, patch)}
                onSubmit={async (input) => {
                  await submitReview(input);
                }}
              />
            );
          }}
          ListEmptyComponent={
            <ScreenState
              variant="empty"
              title="暂无待评价商品"
              description="已完成的订单商品会出现在这里。"
              icon="inventory"
              actionLabel="去逛逛"
              onAction={() =>
                showModal("提示", `可以先去商城看看：${routes.shop()}`, "info")
              }
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-10 gap-4"
          renderItem={({ item }) => {
            const editing = editingReviewId === item.id;
            // 编辑态草稿沿用统一草稿结构，便于复用表单与本地回显。
            const draft =
              draftById[item.id] ??
              {
                rating: item.rating,
                content: item.content ?? "",
                tags: item.tags,
                isAnonymous: item.is_anonymous,
                images: item.images.map((image) => ({ uri: image })),
              };

            return (
              <ReviewedReviewCard
                item={item}
                editing={editing}
                draft={draft}
                submitting={submitting}
                onDraftChange={(patch) => patchDraft(item.id, draft, patch)}
                onStartEdit={() => {
                  setEditingReviewId(item.id);
                  setDraftById((state) => ({
                    ...state,
                    [item.id]: {
                      rating: item.rating,
                      content: item.content ?? "",
                      tags: [...item.tags],
                      isAnonymous: item.is_anonymous,
                      images: item.images.map((image) => ({ uri: image })),
                    },
                  }));
                }}
                onCancelEdit={() => setEditingReviewId(null)}
                onSave={async (input) => {
                  await updateReview(input);
                  setEditingReviewId(null);
                }}
                onDelete={async (reviewId) => {
                  await deleteReview(reviewId);
                }}
              />
            );
          }}
          ListEmptyComponent={
            <ScreenState
              variant="empty"
              title="还没有历史评价"
              description={
                productId
                  ? reviewFilter === "晒图"
                    ? "当前商品还没有带图片的历史评价。"
                    : "当前商品还没有符合筛选条件的历史评价。"
                  : reviewFilter === "晒图"
                    ? "你还没有上传过晒单图片。"
                    : reviewFilter === "好评"
                      ? "你还没有符合条件的好评记录。"
                      : "完成订单评价后，会在这里沉淀你的品饮反馈。"
              }
              icon="rate-review"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
