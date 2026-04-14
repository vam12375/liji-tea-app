import { useEffect, useMemo } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { Colors } from "@/constants/Colors";
import { useMemberPointsStore } from "@/stores/memberPointsStore";
import { useUserStore } from "@/stores/userStore";
import { showModal } from "@/stores/modalStore";

export default function TasksScreen() {
  const session = useUserStore((state) => state.session);
  const tasks = useMemberPointsStore((state) => state.tasks);
  const taskRecords = useMemberPointsStore((state) => state.taskRecords);
  const loading = useMemberPointsStore((state) => state.loading);
  const claiming = useMemberPointsStore((state) => state.claiming);
  const fetchMemberPointsData = useMemberPointsStore((state) => state.fetchMemberPointsData);
  const claimDailyCheckIn = useMemberPointsStore((state) => state.claimDailyCheckIn);
  const hasCheckedInToday = useMemberPointsStore((state) => state.hasCheckedInToday);

  /** 登录后拉取任务配置与完成记录，作为任务中心首屏数据。 */
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    void fetchMemberPointsData();
  }, [fetchMemberPointsData, session?.user?.id]);

  /**
   * 将任务记录整理成完成映射，便于列表渲染时 O(1) 判断是否已完成。
   * 每日签到任务额外结合“今天是否已签到”进行判定。
   */
  const taskCompletionMap = useMemo(() => {
    const completed = new Set<string>();
    for (const record of taskRecords) {
      if (record.task_code === "daily_check_in") {
        if (hasCheckedInToday()) {
          completed.add(record.task_code);
        }
        continue;
      }
      completed.add(record.task_code);
    }
    return completed;
  }, [hasCheckedInToday, taskRecords]);

  if (!session) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="任务中心" />
        <ScreenState
          variant="empty"
          title="登录后查看任务"
          description="签到、评价、发帖、支付等成长任务会出现在这里。"
          icon="task-alt"
        />
      </View>
    );
  }

  if (loading && tasks.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="任务中心" />
        <ScreenState variant="loading" title="正在加载任务..." />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="任务中心" />
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 py-4 gap-3"
        renderItem={({ item }) => {
          const isDailyCheckInTask = item.code === "daily_check_in";
          const completed = isDailyCheckInTask
            ? hasCheckedInToday()
            : taskCompletionMap.has(item.code);

          return (
            <View className="rounded-2xl bg-surface-container-low p-4 gap-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-on-surface text-base font-bold">
                    {item.title}
                  </Text>
                  <Text className="text-on-surface-variant text-xs leading-5">
                    {item.description ?? "完成任务即可获得积分奖励"}
                  </Text>
                </View>
                <View className="px-3 py-1 rounded-full bg-primary-container/20">
                  <Text className="text-primary text-xs font-bold">
                    +{item.points_reward} 积分
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons
                    name={completed ? "check-circle" : "pending-actions"}
                    size={18}
                    color={completed ? Colors.primary : Colors.outline}
                  />
                  <Text className={completed ? "text-primary text-xs font-medium" : "text-on-surface-variant text-xs"}>
                    {completed ? "已完成" : item.cycle_type === "daily" ? "今日可完成" : "待完成"}
                  </Text>
                </View>

                {isDailyCheckInTask ? (
                  <Pressable
                    disabled={completed || claiming}
                    onPress={async () => {
                      // 任务中心内直接领取签到奖励，成功后由 store 统一刷新数据。
                      try {
                        const result = await claimDailyCheckIn();
                        if (!result.success) {
                          showModal("签到提示", "今日签到奖励已领取或任务不可用。", "info");
                          return;
                        }
                        showModal("签到成功", `获得 ${result.points_reward ?? 0} 积分`, "success");
                      } catch (error) {
                        showModal(
                          "签到失败",
                          error instanceof Error ? error.message : "请稍后重试",
                          "error",
                        );
                      }
                    }}
                    className={`px-4 py-2 rounded-full ${completed || claiming ? "bg-outline-variant/30" : "bg-primary-container"}`}
                  >
                    <Text className={completed || claiming ? "text-outline text-xs font-medium" : "text-on-primary text-xs font-medium"}>
                      {completed ? "今日已签" : claiming ? "签到中" : "去签到"}
                    </Text>
                  </Pressable>
                ) : (
                  <Text className="text-outline text-xs">
                    {item.cycle_type === "once" ? "一次性任务" : "每日任务"}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <ScreenState
            variant="empty"
            title="暂无任务"
            description="任务配置准备好后会出现在这里。"
            icon="task-alt"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
