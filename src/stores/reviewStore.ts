import { create } from "zustand";

import {
  buildReviewSummary,
  deleteReview,
  fetchMyReviews,
  fetchPendingReviewItems,
  fetchProductReviews,
  submitReview,
  updateReview,
  type PendingReviewItem,
  type ReviewDraftInput,
  type ReviewRecord,
  type ReviewUpdateInput,
} from "@/lib/reviews";
import { logWarn } from "@/lib/logger";
import { useUserStore } from "@/stores/userStore";

/** 评价 store：统一维护我的评价、待评价列表与商品评价缓存。 */
interface ReviewState {
  myReviews: ReviewRecord[];
  pendingReviewItems: PendingReviewItem[];
  productReviewsById: Record<string, ReviewRecord[]>;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  fetchMyReviews: () => Promise<void>;
  fetchPendingReviewItems: () => Promise<void>;
  fetchProductReviews: (productId: string) => Promise<void>;
  submitReview: (input: ReviewDraftInput) => Promise<ReviewRecord>;
  updateReview: (input: ReviewUpdateInput) => Promise<ReviewRecord>;
  deleteReview: (reviewId: string) => Promise<void>;
  getProductReviewSummary: (productId: string) => ReturnType<typeof buildReviewSummary>;
}

/** 统一提取评价模块错误文案。 */
function getReviewStoreErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const useReviewStore = create<ReviewState>()((set, get) => ({
  myReviews: [],
  pendingReviewItems: [],
  productReviewsById: {},
  loading: false,
  submitting: false,
  error: null,

  /** 拉取当前用户历史评价列表。 */
  fetchMyReviews: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      set({ myReviews: [], loading: false });
      return;
    }

    try {
      set({ loading: true, error: null });
      const reviews = await fetchMyReviews(userId);
      set({ myReviews: reviews, loading: false });
    } catch (error) {
      logWarn("reviewStore", "fetchMyReviews 失败", {
        error: getReviewStoreErrorMessage(error, "加载评价失败"),
      });
      set({ loading: false, error: getReviewStoreErrorMessage(error, "加载评价失败") });
    }
  },

  /** 拉取已签收但尚未评价的订单项。 */
  fetchPendingReviewItems: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      set({ pendingReviewItems: [], loading: false });
      return;
    }

    try {
      set({ loading: true, error: null });
      const items = await fetchPendingReviewItems(userId);
      set({ pendingReviewItems: items, loading: false });
    } catch (error) {
      logWarn("reviewStore", "fetchPendingReviewItems 失败", {
        error: getReviewStoreErrorMessage(error, "加载待评价列表失败"),
      });
      set({ loading: false, error: getReviewStoreErrorMessage(error, "加载待评价列表失败") });
    }
  },

  /** 拉取指定商品的评价，并写入按商品 ID 分桶的缓存。 */
  fetchProductReviews: async (productId) => {
    try {
      set({ loading: true, error: null });
      const reviews = await fetchProductReviews(productId);
      set((state) => ({
        productReviewsById: {
          ...state.productReviewsById,
          [productId]: reviews,
        },
        loading: false,
      }));
    } catch (error) {
      logWarn("reviewStore", "fetchProductReviews 失败", {
        productId,
        error: getReviewStoreErrorMessage(error, "加载商品评价失败"),
      });
      set({ loading: false, error: getReviewStoreErrorMessage(error, "加载商品评价失败") });
    }
  },

  /** 提交评价后同步更新“我的评价”“待评价”和商品评价缓存。 */
  submitReview: async (input) => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      throw new Error("请先登录后再提交评价");
    }

    try {
      set({ submitting: true, error: null });
      const review = await submitReview(userId, input);
      const productId = review.product_id;

      set((state) => ({
        myReviews: [review, ...state.myReviews],
        pendingReviewItems: state.pendingReviewItems.filter(
          (item) => item.orderItem.id !== input.orderItem.id,
        ),
        productReviewsById: {
          ...state.productReviewsById,
          [productId]: [review, ...(state.productReviewsById[productId] ?? [])],
        },
        submitting: false,
      }));

      return review;
    } catch (error) {
      const message = getReviewStoreErrorMessage(error, "提交评价失败");
      logWarn("reviewStore", "submitReview 失败", { error: message });
      set({ submitting: false, error: message });
      throw error;
    }
  },

  /** 更新评价后同步覆盖本地多个列表中的旧数据。 */
  updateReview: async (input) => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      throw new Error("请先登录后再编辑评价");
    }

    try {
      set({ submitting: true, error: null });
      const review = await updateReview(userId, input);
      const productId = review.product_id;

      set((state) => ({
        myReviews: state.myReviews.map((item) =>
          item.id === review.id ? review : item,
        ),
        productReviewsById: {
          ...state.productReviewsById,
          [productId]: (state.productReviewsById[productId] ?? []).map((item) =>
            item.id === review.id ? review : item,
          ),
        },
        submitting: false,
      }));

      return review;
    } catch (error) {
      const message = getReviewStoreErrorMessage(error, "更新评价失败");
      logWarn("reviewStore", "updateReview 失败", { error: message });
      set({ submitting: false, error: message });
      throw error;
    }
  },

  /** 删除评价后从本地缓存中移除，并尝试恢复对应待评价项。 */
  deleteReview: async (reviewId) => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      throw new Error("请先登录后再删除评价");
    }

    try {
      const existingReview =
        get().myReviews.find((item) => item.id === reviewId) ??
        Object.values(get().productReviewsById)
          .flat()
          .find((item) => item.id === reviewId);

      await deleteReview(userId, reviewId);

      set((state) => {
        const nextProductReviewsById = Object.fromEntries(
          Object.entries(state.productReviewsById).map(([productId, reviews]) => [
            productId,
            reviews.filter((item) => item.id !== reviewId),
          ]),
        );

        return {
          myReviews: state.myReviews.filter((item) => item.id !== reviewId),
          productReviewsById: nextProductReviewsById,
          error: null,
        };
      });

      if (existingReview?.order_id && existingReview?.order_item_id) {
        void get().fetchPendingReviewItems();
      }
    } catch (error) {
      const message = getReviewStoreErrorMessage(error, "删除评价失败");
      logWarn("reviewStore", "deleteReview 失败", { error: message, reviewId });
      set({ error: message });
      throw error;
    }
  },

  /** 基于指定商品的缓存评价列表生成概览统计。 */
  getProductReviewSummary: (productId) => {
    const reviews = get().productReviewsById[productId] ?? [];
    return buildReviewSummary(reviews);
  },
}));
