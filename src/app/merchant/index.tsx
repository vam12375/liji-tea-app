import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { MerchantBentoBlock } from "@/components/merchant/MerchantBentoBlock";
import { MerchantHeroStats } from "@/components/merchant/MerchantHeroStats";
import { MerchantScreenHeader } from "@/components/merchant/MerchantScreenHeader";
import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { MerchantColors } from "@/constants/MerchantColors";
import { isMerchantError } from "@/lib/merchantErrors";
import { pushToast } from "@/stores/toastStore";
import { useMerchantStore } from "@/stores/merchantStore";
import { useUserStore } from "@/stores/userStore";

// 商家工作台首页（v4.4.0 扩展）：
// - 头部衬线大标题 + 刷新
// - Hero 四数字：今日订单 / 今日 GMV / 待发货 / 待售后
// - 库存预警 Bento：Top-5 低库存商品，点击直达商品详情
// - 快速入口 Bento：订单 / 售后 / 商品 / 员工 四个跳转按钮（员工跳转仅 admin 可见由权限页自守护）
// 数据源：merchant_dashboard_overview() 聚合 RPC，单次拉取避免多路并发。

interface QuickEntry {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  href: string;
  tone: string;
}

const QUICK_ENTRIES: QuickEntry[] = [
  { label: "订单履约", icon: "receipt-long", href: "/merchant/orders", tone: MerchantColors.statusWait },
  { label: "售后处理", icon: "assignment-return", href: "/merchant/after-sale", tone: MerchantColors.statusStop },
  { label: "商品库存", icon: "inventory-2", href: "/merchant/products", tone: MerchantColors.statusGo },
  { label: "员工管理", icon: "badge", href: "/merchant/staff", tone: MerchantColors.ink500 },
];

// 将聚合 RPC 的 numeric 字段转成两位小数可读字符串，避免把后端原值直接铺到 UI。
function formatGmv(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}w`;
  }
  return value.toFixed(0);
}

export default function MerchantHomeScreen() {
  const role = useUserStore((s) => s.role);
  const dashboard = useMerchantStore((s) => s.dashboard);
  const loading = useMerchantStore((s) => s.dashboardLoading);
  const fetchDashboard = useMerchantStore((s) => s.fetchDashboard);

  useEffect(() => {
    void fetchDashboard().catch((err) => {
      const message = isMerchantError(err) ? err.message : "加载工作台数据失败";
      pushToast({ scope: "merchant", kind: "error", title: message });
    });
  }, [fetchDashboard]);

  const heroItems = useMemo(() => {
    const todayGmv = Number(dashboard?.today_gmv ?? 0);
    return [
      {
        value: dashboard?.today_order_count ?? 0,
        label: "今日订单",
      },
      {
        // count-up 组件只吃 number；这里用整数金额近似，精确值在副标题补足。
        value: Math.round(todayGmv),
        label: `今日 GMV · ${formatGmv(todayGmv)}`,
      },
      {
        value: dashboard?.pending_ship_count ?? 0,
        label: "待发货",
        accent: MerchantColors.statusWait,
        onPress: () => router.push("/merchant/orders"),
      },
      {
        value: dashboard?.pending_after_sale_count ?? 0,
        label: "待售后",
        accent: MerchantColors.statusStop,
        onPress: () => router.push("/merchant/after-sale"),
      },
    ];
  }, [dashboard]);

  const lowStock = dashboard?.low_stock_products ?? [];

  return (
    <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="home" showStaff={role === "admin"} />
      <MerchantScreenHeader
        title="工作台"
        actionIcon="refresh"
        actionLabel={loading ? "刷新中" : "刷新"}
        onAction={() => {
          void fetchDashboard().catch((err) => {
            const message = isMerchantError(err)
              ? err.message
              : "刷新工作台失败";
            pushToast({ scope: "merchant", kind: "error", title: message });
          });
        }}
      />
      {loading && !dashboard ? (
        <ScreenState variant="loading" title="加载中" />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 32,
            gap: 16,
          }}
        >
          <MerchantHeroStats items={heroItems} />

          <Animated.View entering={FadeInDown.delay(40).duration(200)}>
            <MerchantBentoBlock
              title="库存预警"
              summary={
                lowStock.length > 0 ? `${lowStock.length} 款低于阈值` : "本期暂无"
              }
            >
              {lowStock.length === 0 ? (
                <Text
                  style={{
                    color: MerchantColors.ink500,
                    fontSize: 13,
                    paddingVertical: 8,
                  }}
                >
                  所有在售商品库存充足。
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {lowStock.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        router.push({
                          pathname: "/merchant/products/[id]",
                          params: { id: item.id },
                        })
                      }
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 8,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: MerchantColors.ink900,
                          fontSize: 14,
                          flex: 1,
                          marginRight: 12,
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          color: MerchantColors.statusWait,
                          fontSize: 13,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        剩余 {item.stock}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </MerchantBentoBlock>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(200)}>
            <MerchantBentoBlock title="快速入口">
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                {QUICK_ENTRIES.map((entry) => (
                  <Pressable
                    key={entry.href}
                    onPress={() => router.push(entry.href as never)}
                    style={({ pressed }) => ({
                      flexBasis: "47%",
                      flexGrow: 1,
                      paddingVertical: 16,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      backgroundColor: MerchantColors.paper,
                      borderColor: MerchantColors.line,
                      borderWidth: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <MaterialIcons name={entry.icon} size={22} color={entry.tone} />
                    <Text
                      style={{
                        color: MerchantColors.ink900,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {entry.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </MerchantBentoBlock>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}
