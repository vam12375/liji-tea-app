import { useEffect } from "react";
import { View, Text, FlatList } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { Colors } from "@/constants/Colors";
import { useMemberPointsStore } from "@/stores/memberPointsStore";
import { useUserStore } from "@/stores/userStore";

export default function PointsScreen() {
  const session = useUserStore((state) => state.session);
  const ledger = useMemberPointsStore((state) => state.ledger);
  const loading = useMemberPointsStore((state) => state.loading);
  const fetchMemberPointsData = useMemberPointsStore(
    (state) => state.fetchMemberPointsData,
  );

  /** 登录后拉取积分流水与任务数据，保证积分中心展示最新状态。 */
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    void fetchMemberPointsData();
  }, [fetchMemberPointsData, session?.user?.id]);

  if (!session) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="积分明细" />
        <ScreenState
          variant="empty"
          title="登录后查看积分"
          description="签到、评价、发帖等行为获取的积分会沉淀在这里。"
          icon="stars"
        />
      </View>
    );
  }

  if (loading && ledger.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="积分明细" />
        <ScreenState variant="loading" title="正在加载积分明细..." />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="积分明细" />
      <FlatList
        data={ledger}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 py-4 gap-3"
        renderItem={({ item }) => {
          // 正向积分与扣减积分使用不同视觉提示，便于用户快速识别。
          const positive = item.points_delta > 0;
          return (
            <View className="rounded-2xl bg-surface-container-low p-4 gap-2">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-10 h-10 rounded-full bg-primary-container/20 items-center justify-center">
                    <MaterialIcons
                      name={positive ? "south-east" : "north-east"}
                      size={18}
                      color={positive ? Colors.primary : Colors.error}
                    />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-on-surface text-sm font-medium">
                      {item.remark ?? item.task_code ?? "积分变动"}
                    </Text>
                    <Text className="text-outline text-xs">
                      {new Date(item.created_at).toLocaleString("zh-CN")}
                    </Text>
                  </View>
                </View>
                <Text className={positive ? "text-primary font-bold" : "text-error font-bold"}>
                  {positive ? `+${item.points_delta}` : item.points_delta}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-on-surface-variant text-xs">
                  来源：{item.source_type}
                </Text>
                <Text className="text-on-surface-variant text-xs">
                  当前积分：{item.balance_after}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <ScreenState
            variant="empty"
            title="暂无积分记录"
            description="先去签到或完成评价，积分流水会出现在这里。"
            icon="history"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
