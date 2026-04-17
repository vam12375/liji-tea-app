import { create } from "zustand";

import {
  claimDailyCheckIn,
  fetchPointLedger,
  fetchPointTasks,
  fetchUserTaskRecords,
  hasDailyCheckInCompletedToday,
  reconcileFirstPostReward,
  type GrantPointsResult,
  type PointLedgerEntry,
  type PointTask,
  type UserPointTaskRecord,
} from "@/lib/memberPoints";
import { logWarn } from "@/lib/logger";
import { useUserStore } from "@/stores/userStore";

/** 会员积分 store：聚合任务配置、积分流水、任务记录与签到动作。 */
interface MemberPointsState {
  tasks: PointTask[];
  ledger: PointLedgerEntry[];
  taskRecords: UserPointTaskRecord[];
  loading: boolean;
  claiming: boolean;
  error: string | null;
  fetchMemberPointsData: () => Promise<void>;
  claimDailyCheckIn: () => Promise<GrantPointsResult>;
  hasCheckedInToday: () => boolean;
  getRecentLedgerEntries: (limit?: number) => PointLedgerEntry[];
}

/** 统一提取错误提示文案。 */
function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const useMemberPointsStore = create<MemberPointsState>()((set, get) => ({
  tasks: [],
  ledger: [],
  taskRecords: [],
  loading: false,
  claiming: false,
  error: null,

  /** 并行拉取任务、流水与完成记录，作为积分中心的基础数据。 */
  fetchMemberPointsData: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      set({ tasks: [], ledger: [], taskRecords: [], loading: false, error: null });
      return;
    }

    try {
      set({ loading: true, error: null });
      let [tasks, ledger, taskRecords] = await Promise.all([
        fetchPointTasks(),
        fetchPointLedger(userId),
        fetchUserTaskRecords(userId),
      ]);

      // 若历史环境漏发了首次发帖积分，则在拉取任务数据时自动补偿一次，并立即刷新状态。
      const didRepairFirstPostReward = await reconcileFirstPostReward(
        userId,
        taskRecords,
      );
      if (didRepairFirstPostReward) {
        [tasks, ledger, taskRecords] = await Promise.all([
          fetchPointTasks(),
          fetchPointLedger(userId),
          fetchUserTaskRecords(userId),
        ]);
        await useUserStore.getState().fetchProfile();
      }

      set({ tasks, ledger, taskRecords, loading: false });
    } catch (error) {
      const message = getErrorMessage(error, "加载会员积分数据失败");
      logWarn("memberPointsStore", "fetchMemberPointsData 失败", { error: message });
      set({ loading: false, error: message });
    }
  },

  /** 执行每日签到：成功后同步刷新积分中心与个人资料中的积分/等级。 */
  claimDailyCheckIn: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      throw new Error("请先登录后再签到");
    }

    try {
      set({ claiming: true, error: null });
      const result = await claimDailyCheckIn(userId);

      if (result.success) {
        await get().fetchMemberPointsData();
        await useUserStore.getState().fetchProfile();
      }

      set({ claiming: false });
      return result;
    } catch (error) {
      const message = getErrorMessage(error, "签到失败");
      logWarn("memberPointsStore", "claimDailyCheckIn 失败", { error: message });
      set({ claiming: false, error: message });
      throw error;
    }
  },

  /** 今日签到优先依赖任务记录，必要时回退到签到流水，避免重启后按钮状态丢失。 */
  hasCheckedInToday: () =>
    hasDailyCheckInCompletedToday(get().taskRecords, get().ledger),

  /** 截取最近若干条积分流水，供个人中心头部摘要卡片展示。 */
  getRecentLedgerEntries: (limit = 3) => get().ledger.slice(0, limit),
}));
