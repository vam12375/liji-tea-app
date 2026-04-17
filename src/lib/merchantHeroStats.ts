// Hero 数字 count-up 纯函数：给定起点、终点、进度（0~1），返回当前展示值。
// 抽出来避免测试拉进 react-native 运行时导致 Flow 语法报错。

export function interpolateCount(
  from: number,
  to: number,
  progress: number,
): number {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  return Math.round(from + (to - from) * progress);
}

export const COUNT_UP_DURATION_MS = 300;
export const COUNT_UP_FRAME_MS = 16; // ~60fps 足够平滑
