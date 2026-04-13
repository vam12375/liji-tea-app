import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { Colors } from "@/constants/Colors";
import { routes } from "@/lib/routes";
import { showModal } from "@/stores/modalStore";
import {
  useCouponStore,
  type Coupon,
  type UserCoupon,
} from "@/stores/couponStore";
import { useUserStore } from "@/stores/userStore";

function formatCurrency(value: number) {
  return `¥${value.toFixed(2)}`;
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatCouponScope(coupon: Coupon) {
  if (coupon.scope === "shipping") {
    return "适用范围：运费券";
  }

  if (coupon.scope === "category") {
    const categories = coupon.scopeCategoryIds.filter(Boolean);
    return categories.length > 0
      ? `适用范围：分类券（${categories.join("、")}）`
      : "适用范围：分类券";
  }

  if (coupon.scope === "product") {
    const products = coupon.scopeProductIds.filter(Boolean);
    return products.length > 0
      ? `适用范围：指定商品券（${products.length} 件商品）`
      : "适用范围：指定商品券";
  }

  return "适用范围：全场通用";
}

function formatCouponValue(coupon: Coupon) {
  if (coupon.discountType === "fixed") {
    if (coupon.minSpend > 0) {
      return `满 ${formatCurrency(coupon.minSpend)} 减 ${formatCurrency(coupon.discountValue)}`;
    }

    return `立减 ${formatCurrency(coupon.discountValue)}`;
  }

  const normalizedDiscount =
    coupon.discountValue <= 1 ? coupon.discountValue * 10 : coupon.discountValue;

  if (normalizedDiscount === 9) {
    return "9 折";
  }

  if (normalizedDiscount === 8) {
    return "8 折";
  }

  if (normalizedDiscount <= 10) {
    return `${normalizedDiscount.toFixed(1).replace(/\.0$/, "")} 折`;
  }

  return `${normalizedDiscount.toFixed(0)}% OFF`;
}

function formatCouponCondition(coupon: Coupon) {
  const threshold =
    coupon.minSpend > 0 ? `订单满 ${formatCurrency(coupon.minSpend)} 可用` : "无门槛可用";
  const maxDiscount = coupon.maxDiscount !== null
    ? `，最高优惠 ${formatCurrency(coupon.maxDiscount)}`
    : "";

  return `${threshold}${maxDiscount}`;
}

function formatCouponValidity(coupon: Coupon) {
  const start = formatDateLabel(coupon.startsAt);
  const end = formatDateLabel(coupon.endsAt);

  if (start && end) {
    return `有效期 ${start} - ${end}`;
  }

  if (end) {
    return `有效期至 ${end}`;
  }

  if (start) {
    return `${start} 起可用`;
  }

  return "长期有效";
}

function formatUserCouponStatus(status: UserCoupon["status"]) {
  switch (status) {
    case "available":
      return "可使用";
    case "locked":
      return "已锁定";
    case "used":
      return "已使用";
    case "expired":
      return "已失效";
  }
}

function getUserCouponStatusHint(userCoupon: UserCoupon) {
  if (userCoupon.status === "locked") {
    return userCoupon.lockExpiresAt
      ? `已锁定至 ${formatDateLabel(userCoupon.lockExpiresAt) ?? "待释放"}`
      : "该优惠券正在被待支付订单占用";
  }

  if (userCoupon.status === "used") {
    return userCoupon.usedAt
      ? `使用时间 ${formatDateLabel(userCoupon.usedAt) ?? "已使用"}`
      : "该优惠券已完成核销";
  }

  if (userCoupon.status === "expired") {
    return "该优惠券已过期或不可继续使用";
  }

  return "点击后可在当前订单中使用";
}

function SectionHeader({
  title,
  helper,
}: {
  title: string;
  helper?: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-on-surface text-base font-bold">{title}</Text>
      {helper ? <Text className="text-outline text-xs">{helper}</Text> : null}
    </View>
  );
}

export default function CouponsScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const selectionMode = mode === "select";

  const session = useUserStore((state) => state.session);
  const publicCoupons = useCouponStore((state) => state.publicCoupons);
  const userCoupons = useCouponStore((state) => state.userCoupons);
  const selectedUserCouponId = useCouponStore(
    (state) => state.selectedUserCouponId,
  );
  const loadingPublic = useCouponStore((state) => state.loadingPublic);
  const loadingUser = useCouponStore((state) => state.loadingUser);
  const claiming = useCouponStore((state) => state.claiming);
  const claimCoupon = useCouponStore((state) => state.claimCoupon);
  const setSelectedUserCouponId = useCouponStore(
    (state) => state.setSelectedUserCouponId,
  );
  const clearSelectedCoupon = useCouponStore(
    (state) => state.clearSelectedCoupon,
  );

  // 优惠券数据已由根布局和登录态切换统一预取，这个页面只消费 store，避免进入页时再次重复请求。
  const [redeemCode, setRedeemCode] = useState("");

  const selectedCoupon = useMemo(
    () => userCoupons.find((item) => item.id === selectedUserCouponId) ?? null,
    [selectedUserCouponId, userCoupons],
  );

  const availableCouponCount = useMemo(
    () => userCoupons.filter((item) => item.status === "available").length,
    [userCoupons],
  );

  const sortedUserCoupons = useMemo(() => {
    const statusPriority: Record<UserCoupon["status"], number> = {
      available: 0,
      locked: 1,
      used: 2,
      expired: 3,
    };

    return [...userCoupons].sort((left, right) => {
      const priorityDiff =
        statusPriority[left.status] - statusPriority[right.status];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return (
        new Date(right.claimedAt).getTime() - new Date(left.claimedAt).getTime()
      );
    });
  }, [userCoupons]);

  const ownedCouponCountMap = useMemo(() => {
    return userCoupons.reduce<Record<string, number>>((result, item) => {
      result[item.couponId] = (result[item.couponId] ?? 0) + 1;
      return result;
    }, {});
  }, [userCoupons]);

  const handleClaim = async (input: { couponId?: string; code?: string }) => {
    if (!session) {
      router.push(routes.login);
      return;
    }

    const result = await claimCoupon(input);
    if (result.error) {
      showModal("领取失败", result.error, "error");
      return;
    }

    if (selectionMode && result.userCouponId) {
      setSelectedUserCouponId(result.userCouponId);
      router.back();
      return;
    }

    showModal("领取成功", "优惠券已存入账户，可在结算页中使用。", "success");
  };

  const handleRedeem = async () => {
    const normalizedCode = redeemCode.trim();
    if (!normalizedCode) {
      showModal("请输入券码", "请输入有效的优惠券码后再领取。", "info");
      return;
    }

    await handleClaim({ code: normalizedCode });
    setRedeemCode("");
  };

  const handleSelectUserCoupon = (userCoupon: UserCoupon) => {
    if (userCoupon.status !== "available") {
      showModal(
        "当前不可使用",
        getUserCouponStatusHint(userCoupon),
        "info",
      );
      return;
    }

    if (!selectionMode) {
      showModal(
        "可在结算页使用",
        "进入结算页后即可选择这张优惠券抵扣订单金额。",
        "info",
      );
      return;
    }

    setSelectedUserCouponId(userCoupon.id);
    router.back();
  };

  const handleClearSelection = () => {
    clearSelectedCoupon();
    if (selectionMode) {
      router.back();
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: selectionMode ? "选择优惠券" : "优惠券中心",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={Colors.onSurface}
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-4 gap-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-surface-container-low rounded-2xl p-4 gap-3">
          <View className="flex-row items-center gap-2">
            <MaterialIcons
              name="local-offer"
              size={18}
              color={Colors.primary}
            />
            <Text className="text-on-surface text-base font-bold">
              {selectionMode ? "选择本单可用优惠券" : "领券后下单更划算"}
            </Text>
          </View>

          <Text className="text-outline text-sm leading-6">
            {session
              ? `当前账户共有 ${availableCouponCount} 张可用优惠券，可在结算时与系统活动优惠叠加使用。`
              : "登录后可领取专属优惠券，并在结算页实时抵扣订单金额。"}
          </Text>

          {selectionMode ? (
            <Pressable
              onPress={handleClearSelection}
              className="rounded-xl bg-background px-4 py-3 active:opacity-80"
            >
              <Text className="text-on-surface text-sm font-medium">
                不使用优惠券
              </Text>
              <Text className="text-outline text-xs mt-1">
                {selectedCoupon?.coupon
                  ? `当前已选：${selectedCoupon.coupon.title}`
                  : "保持原价结算，不使用任何优惠券"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {session ? (
          <View className="bg-surface-container-low rounded-2xl p-4 gap-3">
            <SectionHeader title="兑换券码" helper="输入券码直接领取" />
            <View className="flex-row items-center gap-3">
              <TextInput
                value={redeemCode}
                onChangeText={setRedeemCode}
                autoCapitalize="characters"
                placeholder="输入优惠券码"
                placeholderTextColor={Colors.outline}
                className="flex-1 bg-background rounded-xl px-4 py-3 text-sm text-on-surface"
              />
              <Pressable
                onPress={() => void handleRedeem()}
                disabled={claiming}
                className="rounded-xl px-4 py-3 active:opacity-80"
                style={{
                  backgroundColor: claiming
                    ? Colors.outlineVariant
                    : Colors.primaryContainer,
                }}
              >
                <Text className="text-on-primary text-sm font-medium">
                  {claiming ? "领取中" : "兑换"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push(routes.login)}
            className="bg-surface-container-low rounded-2xl p-4 gap-2 active:opacity-80"
          >
            <SectionHeader title="登录后可领取更多优惠" />
            <Text className="text-outline text-sm leading-6">
              登录后可查看个人优惠券、领取活动券，并在结算页直接使用。
            </Text>
          </Pressable>
        )}

        <View className="gap-3">
          <SectionHeader
            title="我的优惠券"
            helper={session ? `${userCoupons.length} 张` : undefined}
          />

          {session ? (
            loadingUser ? (
              <View className="bg-surface-container-low rounded-2xl py-8 items-center justify-center gap-3">
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text className="text-outline text-sm">正在加载优惠券...</Text>
              </View>
            ) : sortedUserCoupons.length > 0 ? (
              sortedUserCoupons.map((item) => {
                const coupon = item.coupon;
                const isSelected = item.id === selectedUserCouponId;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSelectUserCoupon(item)}
                    className={`rounded-2xl p-4 gap-3 border active:opacity-85 ${
                      isSelected
                        ? "bg-primary/5 border-primary"
                        : item.status === "available"
                          ? "bg-surface-container-low border-transparent"
                          : "bg-surface-container-low border-outline-variant/20"
                    }`}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <Text className="text-primary text-lg font-bold">
                          {coupon ? formatCouponValue(coupon) : "优惠券"}
                        </Text>
                        <Text className="text-on-surface text-sm font-medium">
                          {coupon?.title ?? "优惠券信息待同步"}
                        </Text>
                        <Text className="text-outline text-xs leading-5">
                          {coupon ? formatCouponCondition(coupon) : "请稍后重试"}
                        </Text>
                      </View>

                      <View
                        className={`px-3 py-1 rounded-full ${
                          isSelected
                            ? "bg-primary/10"
                            : item.status === "available"
                              ? "bg-primary/10"
                              : item.status === "locked"
                                ? "bg-tertiary/10"
                                : item.status === "used"
                                  ? "bg-outline-variant/30"
                                  : "bg-error/10"
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            isSelected
                              ? "text-primary"
                              : item.status === "available"
                                ? "text-primary"
                                : item.status === "locked"
                                  ? "text-tertiary"
                                  : item.status === "used"
                                    ? "text-outline"
                                    : "text-error"
                          }`}
                        >
                          {isSelected ? "已选择" : formatUserCouponStatus(item.status)}
                        </Text>
                      </View>
                    </View>

                    {coupon?.description ? (
                      <Text className="text-on-surface-variant text-xs leading-5">
                        {coupon.description}
                      </Text>
                    ) : null}

                    <View className="border-t border-outline-variant/10 pt-3 gap-1">
                      <Text className="text-outline text-xs">
                        {coupon ? formatCouponValidity(coupon) : "有效期待同步"}
                      </Text>
                      <Text className="text-outline text-xs">
                        券码：{coupon?.code ?? "待同步"}
                      </Text>
                      <Text className="text-outline text-xs">
                        {getUserCouponStatusHint(item)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View className="bg-surface-container-low rounded-2xl px-4 py-6 gap-2 items-center">
                <MaterialIcons
                  name="confirmation-number"
                  size={30}
                  color={Colors.outlineVariant}
                />
                <Text className="text-on-surface text-sm font-medium">
                  暂无已领取优惠券
                </Text>
                <Text className="text-outline text-xs leading-5 text-center">
                  下方券中心可直接领取活动券，领取后将在这里展示。
                </Text>
              </View>
            )
          ) : (
            <View className="bg-surface-container-low rounded-2xl px-4 py-6 gap-2 items-center">
              <MaterialIcons
                name="lock-outline"
                size={28}
                color={Colors.outlineVariant}
              />
              <Text className="text-on-surface text-sm font-medium">
                登录后查看个人优惠券
              </Text>
            </View>
          )}
        </View>

        <View className="gap-3">
          <SectionHeader
            title="领券中心"
            helper={publicCoupons.length > 0 ? `${publicCoupons.length} 张` : undefined}
          />

          {loadingPublic ? (
            <View className="bg-surface-container-low rounded-2xl py-8 items-center justify-center gap-3">
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text className="text-outline text-sm">正在加载活动优惠券...</Text>
            </View>
          ) : publicCoupons.length > 0 ? (
            publicCoupons.map((coupon) => {
              const ownedCount = ownedCouponCountMap[coupon.id] ?? 0;

              return (
                <View
                  key={coupon.id}
                  className="bg-surface-container-low rounded-2xl p-4 gap-3"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 gap-1">
                      <Text className="text-primary text-lg font-bold">
                        {formatCouponValue(coupon)}
                      </Text>
                      <Text className="text-on-surface text-sm font-medium">
                        {coupon.title}
                      </Text>
                      <Text className="text-outline text-xs leading-5">
                        {formatCouponCondition(coupon)}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => void handleClaim({ couponId: coupon.id })}
                      disabled={claiming}
                      className="rounded-xl px-4 py-2 active:opacity-80"
                      style={{
                        backgroundColor: claiming
                          ? Colors.outlineVariant
                          : Colors.primaryContainer,
                      }}
                    >
                      <Text className="text-on-primary text-sm font-medium">
                        {claiming ? "领取中" : "立即领取"}
                      </Text>
                    </Pressable>
                  </View>

                  {coupon.description ? (
                    <Text className="text-on-surface-variant text-xs leading-5">
                      {coupon.description}
                    </Text>
                  ) : null}

                  <View className="border-t border-outline-variant/10 pt-3 gap-1">
                    <Text className="text-outline text-xs leading-5">
                      {formatCouponScope(coupon)}
                    </Text>
                    <Text className="text-outline text-xs">
                      {formatCouponValidity(coupon)}
                    </Text>
                    <Text className="text-outline text-xs">券码：{coupon.code}</Text>
                    {ownedCount > 0 ? (
                      <Text className="text-primary text-xs">
                        已领取 {ownedCount} 张，可继续按活动规则领取
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View className="bg-surface-container-low rounded-2xl px-4 py-6 gap-2 items-center">
              <MaterialIcons
                name="local-offer"
                size={30}
                color={Colors.outlineVariant}
              />
              <Text className="text-on-surface text-sm font-medium">
                暂无可领取优惠券
              </Text>
              <Text className="text-outline text-xs leading-5 text-center">
                当前没有进行中的领券活动，稍后再来看看。
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
