const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

// 订单相关时间统一按东八区展示，避免不同运行环境把 UTC 直接显示给用户。
export function formatChinaDateTime(
  value?: string | null,
  fallback = "待更新",
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const chinaDate = new Date(date.getTime() + CHINA_TIME_OFFSET_MS);
  return `${chinaDate.getUTCFullYear()}-${pad(chinaDate.getUTCMonth() + 1)}-${pad(
    chinaDate.getUTCDate(),
  )} ${pad(chinaDate.getUTCHours())}:${pad(chinaDate.getUTCMinutes())}`;
}
