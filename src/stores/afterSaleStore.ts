// 售后申请状态容器：收拢"当前详情 + 按订单维度的缓存"，避免页面层各自缓存造成列表/详情不一致。
// 所有写入路径统一走 @/lib/afterSale 对 Edge Function 的封装，再回源一次详情保证 UI 与服务端一致。
import { create } from "zustand";

import {
  cancelAfterSaleRequest,
  createAfterSaleRequest,
  fetchAfterSaleRequestById,
  fetchOrderAfterSaleRequest,
  type AfterSaleRequestView,
  type CreateAfterSaleRequestInput,
  uploadAfterSaleEvidence,
} from "@/lib/afterSale";
import { logWarn } from "@/lib/logger";

interface AfterSaleState {
  // 售后详情页当前正在查看的申请，使用者负责在离场时调用 clearCurrent。
  currentRequest: AfterSaleRequestView | null;
  // 按订单 id 缓存最近一次请求的结果，供订单列表 / 订单详情快速展示"是否已申请售后"。
  requestByOrderId: Record<string, AfterSaleRequestView | null | undefined>;
  loading: boolean;
  submitting: boolean;
  uploading: boolean;
  canceling: boolean;
  error: string | null;
  clearCurrent: () => void;
  fetchRequestById: (requestId: string) => Promise<AfterSaleRequestView | null>;
  fetchRequestByOrderId: (orderId: string) => Promise<AfterSaleRequestView | null>;
  createRequest: (
    input: CreateAfterSaleRequestInput,
  ) => Promise<AfterSaleRequestView>;
  uploadEvidence: (params: {
    requestId: string;
    base64: string;
    ext?: string;
    sortOrder: number;
  }) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<AfterSaleRequestView | null>;
}

// 统一错误文案回退：保证 logWarn 与 UI 看到的都是可读字符串，而不是 unknown。
function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const useAfterSaleStore = create<AfterSaleState>()((set, get) => ({
  currentRequest: null,
  requestByOrderId: {},
  loading: false,
  submitting: false,
  uploading: false,
  canceling: false,
  error: null,

  clearCurrent: () => set({ currentRequest: null, error: null }),

  fetchRequestById: async (requestId) => {
    try {
      set({ loading: true, error: null });
      const request = await fetchAfterSaleRequestById(requestId);
      set((state) => ({
        currentRequest: request,
        requestByOrderId: request
          ? {
              ...state.requestByOrderId,
              [request.order_id]: request,
            }
          : state.requestByOrderId,
        loading: false,
      }));
      return request;
    } catch (error) {
      const message = getErrorMessage(error, "加载售后详情失败");
      logWarn("afterSaleStore", "fetchRequestById 失败", {
        requestId,
        error: message,
      });
      set({ loading: false, error: message });
      throw error;
    }
  },

  fetchRequestByOrderId: async (orderId) => {
    try {
      set({ loading: true, error: null });
      const request = await fetchOrderAfterSaleRequest(orderId);
      set((state) => ({
        requestByOrderId: {
          ...state.requestByOrderId,
          [orderId]: request,
        },
        currentRequest:
          state.currentRequest?.order_id === orderId
            ? request
            : state.currentRequest,
        loading: false,
      }));
      return request;
    } catch (error) {
      const message = getErrorMessage(error, "加载订单售后信息失败");
      logWarn("afterSaleStore", "fetchRequestByOrderId 失败", {
        orderId,
        error: message,
      });
      set({ loading: false, error: message });
      throw error;
    }
  },

  createRequest: async (input) => {
    try {
      set({ submitting: true, error: null });
      const result = await createAfterSaleRequest(input);
      // Edge Function 返回的是摘要，凭证与 evidences 数据仍要再拉一次详情才完整。
      const request = await fetchAfterSaleRequestById(result.requestId);

      if (!request) {
        throw new Error("售后申请已创建，但详情同步失败");
      }

      set((state) => ({
        currentRequest: request,
        requestByOrderId: {
          ...state.requestByOrderId,
          [request.order_id]: request,
        },
        submitting: false,
      }));

      return request;
    } catch (error) {
      const message = getErrorMessage(error, "提交退款申请失败");
      logWarn("afterSaleStore", "createRequest 失败", {
        orderId: input.orderId,
        error: message,
      });
      set({ submitting: false, error: message });
      throw error;
    }
  },

  uploadEvidence: async (params) => {
    try {
      set({ uploading: true, error: null });
      // 凭证上传走 Storage + 数据库两步；成功后再拉一次详情同步 evidences 列表。
      await uploadAfterSaleEvidence(params);
      const request = await fetchAfterSaleRequestById(params.requestId);

      set((state) => ({
        currentRequest:
          state.currentRequest?.id === params.requestId
            ? request
            : state.currentRequest,
        requestByOrderId:
          request && request.order_id
            ? {
                ...state.requestByOrderId,
                [request.order_id]: request,
              }
            : state.requestByOrderId,
        uploading: false,
      }));
    } catch (error) {
      const message = getErrorMessage(error, "上传售后凭证失败");
      logWarn("afterSaleStore", "uploadEvidence 失败", {
        requestId: params.requestId,
        error: message,
      });
      set({ uploading: false, error: message });
      throw error;
    }
  },

  cancelRequest: async (requestId) => {
    try {
      set({ canceling: true, error: null });
      await cancelAfterSaleRequest(requestId);
      // 撤销后申请仍会保留在表里（状态变为 cancelled），所以继续拉回最新快照而不是直接清空。
      const request = await fetchAfterSaleRequestById(requestId);

      set((state) => ({
        currentRequest:
          state.currentRequest?.id === requestId ? request : state.currentRequest,
        requestByOrderId:
          request && request.order_id
            ? {
                ...state.requestByOrderId,
                [request.order_id]: request,
              }
            : state.requestByOrderId,
        canceling: false,
      }));

      return request;
    } catch (error) {
      const message = getErrorMessage(error, "撤销售后申请失败");
      logWarn("afterSaleStore", "cancelRequest 失败", {
        requestId,
        error: message,
      });
      set({ canceling: false, error: message });
      throw error;
    }
  },
}));
