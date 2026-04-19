import { useCallback, useRef, useState } from "react";
import { Animated } from "react-native";

/**
 * 商品详情页"加入购物车"复合动画集中封装：
 * - 顶部打钩 Toast 淡入淡出
 * - 商品图位置飞出的红点轨迹
 * - 底部购物车抖动 + 角标弹跳
 *
 * 抽离为 hook 主要目的：缩短 detail 页主文件、让动画时序可读、便于后续替换成 Reanimated。
 */
export function useAddToCartAnimation() {
  const [showToast, setShowToast] = useState(false);
  const [showDot, setShowDot] = useState(false);

  // 动画值：分别驱动 Toast、购物车抖动、角标弹跳与飞点轨迹
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(20)).current;
  const toastScale = useRef(new Animated.Value(0.8)).current;
  const cartShake = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const dotTranslateY = useRef(new Animated.Value(0)).current;
  const dotTranslateX = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  const play = useCallback(() => {
    // 1. 显示打钩 Toast
    setShowToast(true);
    toastOpacity.setValue(0);
    toastTranslateY.setValue(20);
    toastScale.setValue(0.8);
    checkScale.setValue(0);

    Animated.parallel([
      Animated.spring(toastOpacity, { toValue: 1, useNativeDriver: true }),
      Animated.spring(toastTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 12,
      }),
      Animated.spring(toastScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
      }),
    ]).start();

    // 打钩弹出
    setTimeout(() => {
      Animated.spring(checkScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 8,
      }).start();
    }, 150);

    // 2. 飞入红点动画（延迟 300ms）
    setTimeout(() => {
      setShowDot(true);
      dotOpacity.setValue(1);
      dotScale.setValue(1);
      dotTranslateY.setValue(0);
      dotTranslateX.setValue(0);

      Animated.parallel([
        // 红点飞向左侧购物车（向左移动、向下移动）
        Animated.timing(dotTranslateX, {
          toValue: -100,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(dotTranslateY, {
          toValue: 20,
          duration: 450,
          useNativeDriver: true,
        }),
        // 缩小消失
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(dotScale, {
            toValue: 0.3,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
        // 淡出
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(dotOpacity, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => setShowDot(false));
    }, 300);

    // 3. 购物车图标抖动（延迟 700ms，红点到达时触发）
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(cartShake, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: 3, duration: 40, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();

      // Badge 弹跳
      Animated.sequence([
        Animated.spring(badgeScale, {
          toValue: 1.4,
          useNativeDriver: true,
          damping: 6,
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 8,
        }),
      ]).start();
    }, 700);

    // 4. Toast 自动消失
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -10,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setShowToast(false));
    }, 1800);
  }, [
    badgeScale,
    cartShake,
    checkScale,
    dotOpacity,
    dotScale,
    dotTranslateX,
    dotTranslateY,
    toastOpacity,
    toastScale,
    toastTranslateY,
  ]);

  return {
    showToast,
    showDot,
    toastOpacity,
    toastTranslateY,
    toastScale,
    cartShake,
    badgeScale,
    dotOpacity,
    dotTranslateY,
    dotTranslateX,
    dotScale,
    checkScale,
    play,
  };
}

export type AddToCartAnimation = ReturnType<typeof useAddToCartAnimation>;
