import { supabase } from "@/lib/supabase";

/** 积分任务定义：描述前台任务中心展示所需的配置字段。 */
export interface PointTask {
  id: string;
  code: string;
  title: string;
  description: string | null;
  points_reward: number;
  cycle_type: "once" | "daily";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** 积分流水记录：反映每次积分变动与变动后的余额。 */
export interface PointLedgerEntry {
  id: string;
  user_id: string;
  task_code: string | null;
  change_type: "earn" | "spend" | "adjust";
  points_delta: number;
  balance_after: number;
  source_type: string;
  source_id: string | null;
  remark: string | null;
  created_at: string;
}

/** 用户任务完成记录：用于判断一次性/每日任务是否已领取。 */
export interface UserPointTaskRecord {
  id: string;
  user_id: string;
  task_code: string;
  task_date: string | null;
  source_id: string | null;
  created_at: string;
}

/** 发放积分 RPC 的返回结构。 */
export interface GrantPointsResult {
  success: boolean;
  reason?: string;
  ledger_id?: string;
  points?: number;
  member_tier?: string;
  points_reward?: number;
}

/** 获取所有启用中的积分任务配置。 */
export async function fetchPointTasks() {
  const { data, error } = await supabase
    .from("point_tasks")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "加载积分任务失败");
  }

  return (data ?? []) as PointTask[];
}

/** 查询当前用户的积分流水，按时间倒序返回最近 100 条。 */
export async function fetchPointLedger(userId: string) {
  const { data, error } = await supabase
    .from("point_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message || "加载积分明细失败");
  }

  return (data ?? []) as PointLedgerEntry[];
}

/** 查询当前用户的任务完成记录，用于任务中心与签到状态判定。 */
export async function fetchUserTaskRecords(userId: string) {
  const { data, error } = await supabase
    .from("user_point_task_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "加载任务记录失败");
  }

  return (data ?? []) as UserPointTaskRecord[];
}

/** 调用后端积分发放函数，领取“每日签到”任务奖励。 */
export async function claimDailyCheckIn(userId: string) {
  const { data, error } = await supabase.rpc("grant_points_for_task", {
    p_user_id: userId,
    p_task_code: "daily_check_in",
    p_source_type: "check_in",
    p_source_id: null,
    p_remark: "每日签到奖励",
    p_task_date: new Date().toISOString().slice(0, 10),
  });

  if (error) {
    throw new Error(error.message || "签到失败");
  }

  return (data ?? { success: false, reason: "unknown" }) as GrantPointsResult;
}

/** 判断某个任务今天是否已经完成，主要用于每日任务按钮禁用态。 */
export function isTaskCompletedToday(taskCode: string, records: UserPointTaskRecord[]) {
  const today = new Date().toISOString().slice(0, 10);
  return records.some(
    (record) => record.task_code === taskCode && record.task_date === today,
  );
}
