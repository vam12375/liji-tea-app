import { useEffect, useState } from "react";

/**
 * 提供实时更新的当前时间戳，用于倒计时等场景。
 * 
 * @param intervalMs 更新间隔（毫秒），默认 1000ms（1 秒）
 * @returns 当前时间戳（毫秒）
 * 
 * @example
 * ```tsx
 * const now = useNow();
 * const deadline = Date.now() + 60000;
 * const remaining = deadline - now;
 * ```
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
