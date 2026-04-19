import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { routes } from "@/lib/routes";

import type { AddToCartAnimation } from "./useAddToCartAnimation";

interface Props {
  productId: string;
  quantity: number;
  cartCount: number;
  stock: number;
  onAddToCart: () => void;
  animation: AddToCartAnimation;
}

/**
 * 商品详情页底部操作栏 + 加购反馈层。
 * - 内含加购成功 Toast、飞入红点、购物车图标（抖动 + 角标弹跳）、加购/立即购买按钮。
 * - 所有动画值由父层通过 useAddToCartAnimation hook 提供。
 */
export function ProductBottomBar({
  productId,
  quantity,
  cartCount,
  stock,
  onAddToCart,
  animation,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const soldOut = stock === 0;

  return (
    <>
      {animation.showToast && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: 100 + (insets.bottom || 16),
            alignSelf: "center",
            opacity: animation.toastOpacity,
            transform: [
              { translateY: animation.toastTranslateY },
              { scale: animation.toastScale },
            ],
          }}
          className="bg-on-surface/85 rounded-2xl px-6 py-3 flex-row items-center gap-3"
          pointerEvents="none"
        >
          <Animated.View
            style={{ transform: [{ scale: animation.checkScale }] }}
            className="w-7 h-7 rounded-full bg-primary items-center justify-center"
          >
            <MaterialIcons name="check" size={18} color="#fff" />
          </Animated.View>
          <Text className="text-surface-bright text-sm font-medium">
            已加入购物车
          </Text>
        </Animated.View>
      )}

      {animation.showDot && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: 36 + (insets.bottom || 16),
            right: "38%",
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: Colors.error,
            opacity: animation.dotOpacity,
            transform: [
              { translateX: animation.dotTranslateX },
              { translateY: animation.dotTranslateY },
              { scale: animation.dotScale },
            ],
          }}
          pointerEvents="none"
        />
      )}

      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3 flex-row items-center gap-3"
      >
        <Animated.View style={{ transform: [{ translateX: animation.cartShake }] }}>
          <Pressable
            onPress={() => router.push(routes.cart)}
            className="w-12 h-12 rounded-full border border-outline-variant items-center justify-center relative"
          >
            <MaterialIcons name="shopping-cart" size={22} color={Colors.primary} />
            {cartCount > 0 && (
              <Animated.View
                style={{ transform: [{ scale: animation.badgeScale }] }}
                className="absolute -top-1 -right-1 bg-error w-5 h-5 rounded-full items-center justify-center"
              >
                <Text className="text-on-error text-[10px] font-bold">
                  {cartCount > 99 ? "99+" : cartCount}
                </Text>
              </Animated.View>
            )}
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={onAddToCart}
          className={`flex-1 bg-surface-container-high h-12 rounded-full items-center justify-center active:bg-surface-container-highest ${soldOut ? "opacity-50" : ""}`}
        >
          <Text className="text-on-surface font-medium">加入购物车</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (soldOut) return;
            router.push(routes.checkout(productId, quantity));
          }}
          className={`flex-1 bg-primary-container h-12 rounded-full items-center justify-center active:bg-primary ${soldOut ? "opacity-50" : ""}`}
        >
          <Text className="text-on-primary font-medium">立即购买</Text>
        </Pressable>
      </View>
    </>
  );
}
