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

const DAILY_CHECK_IN_TASK_CODE = "daily_check_in";
const DAILY_CHECK_IN_SOURCE_TYPE = "check_in";
const FIRST_POST_TASK_CODE = "first_post";
const FIRST_POST_SOURCE_TYPE = "post";

function padDateSegment(value: number) {
  return String(value).padStart(2, "0");
}

// 每日签到按设备本地日期判断，避免 UTC 切日导致“今天已签”状态丢失。
function getCurrentLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${padDateSegment(date.getMonth() + 1)}-${padDateSegment(
    date.getDate(),
  )}`;
}

function normalizeCode(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

// 兜底把流水时间也转换为本地日期键，兼容历史 task_date 异常或记录同步延迟。
function isSameLocalDate(value: string, dateKey: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return getCurrentLocalDateKey(date) === dateKey;
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
    p_task_code: DAILY_CHECK_IN_TASK_CODE,
    p_source_type: DAILY_CHECK_IN_SOURCE_TYPE,
    p_source_id: null,
    p_remark: "每日签到奖励",
    p_task_date: getCurrentLocalDateKey(),
  });

  if (error) {
    throw new Error(error.message || "签到失败");
  }

  return (data ?? { success: false, reason: "unknown" }) as GrantPointsResult;
}

/**
 * 历史环境中若首次发帖触发器未生效，这里会在检测到用户已有帖子但缺少任务记录时补发一次积分。
 * grant_points_for_task 本身具备幂等性，因此重复调用只会返回 already_completed。
 */
export async function reconcileFirstPostReward(
  userId: string,
  taskRecords: UserPointTaskRecord[],
) {
  const hasFirstPostRecord = taskRecords.some(
    (record) => normalizeCode(record.task_code) === FIRST_POST_TASK_CODE,
  );
  if (hasFirstPostRecord) {
    return false;
  }

  const { data: firstPost, error: postError } = await supabase
    .from("posts")
    .select("id")
    .eq("author_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (postError) {
    throw new Error(postError.message || "检查首次发帖记录失败");
  }

  if (!firstPost?.id) {
    return false;
  }

  const { data, error } = await supabase.rpc("grant_points_for_task", {
    p_user_id: userId,
    p_task_code: FIRST_POST_TASK_CODE,
    p_source_type: FIRST_POST_SOURCE_TYPE,
    p_source_id: firstPost.id,
    p_remark: "首次发帖奖励",
  });

  if (error) {
    throw new Error(error.message || "补发首次发帖积分失败");
  }

  const result = (data ?? { success: false, reason: "unknown" }) as GrantPointsResult;
  return result.success === true || result.reason === "already_completed";
}

/** 判断某个任务今天是否已经完成，主要用于每日任务按钮禁用态。 */
export function isTaskCompletedToday(taskCode: string, records: UserPointTaskRecord[]) {
  const today = getCurrentLocalDateKey();
  const normalizedTaskCode = normalizeCode(taskCode);

  return records.some(
    (record) =>
      normalizeCode(record.task_code) === normalizedTaskCode &&
      record.task_date === today,
  );
}

/** 每日签到优先依赖任务记录，必要时回退到当天签到积分流水，保证重启后状态稳定恢复。 */
export function hasDailyCheckInCompletedToday(
  records: UserPointTaskRecord[],
  ledger: PointLedgerEntry[],
) {
  const today = getCurrentLocalDateKey();

  if (isTaskCompletedToday(DAILY_CHECK_IN_TASK_CODE, records)) {
    return true;
  }

  return ledger.some(
    (entry) =>
      normalizeCode(entry.source_type) === DAILY_CHECK_IN_SOURCE_TYPE &&
      entry.points_delta > 0 &&
      isSameLocalDate(entry.created_at, today),
  );
}
