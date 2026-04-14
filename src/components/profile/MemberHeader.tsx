import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { routes } from "@/lib/routes";
import { useMemberPointsStore } from "@/stores/memberPointsStore";
import { useUserStore } from "@/stores/userStore";
import { showModal } from "@/stores/modalStore";

/** 会员等级阈值配置：用于计算进度条与下一等级提示文案。 */
const TIER_CONFIG: Record<string, { floor: number; ceiling: number; next: string | null }> = {
  "新叶会员": { floor: 0, ceiling: 500, next: "翡翠会员" },
  "翡翠会员": { floor: 500, ceiling: 2000, next: "金叶会员" },
  "金叶会员": { floor: 2000, ceiling: 2000, next: null },
};

export default function MemberHeader() {
  const session = useUserStore((state) => state.session);
  const name = useUserStore((state) => state.name);
  const avatar = useUserStore((state) => state.avatar);
  const memberTier = useUserStore((state) => state.memberTier);
  const points = useUserStore((state) => state.points);
  const uploadAvatar = useUserStore((state) => state.uploadAvatar);
  const fetchProfile = useUserStore((state) => state.fetchProfile);
  const fetchMemberPointsData = useMemberPointsStore((state) => state.fetchMemberPointsData);
  const claimDailyCheckIn = useMemberPointsStore((state) => state.claimDailyCheckIn);
  const hasCheckedInToday = useMemberPointsStore((state) => state.hasCheckedInToday);
  const getRecentLedgerEntries = useMemberPointsStore((state) => state.getRecentLedgerEntries);
  const claiming = useMemberPointsStore((state) => state.claiming);
  const router = useRouter();
  const displayName = name || "茶友";
  const [uploading, setUploading] = useState(false);

  /** 登录后同步拉取用户资料与积分数据，保证头部信息完整。 */
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    void Promise.all([fetchProfile(), fetchMemberPointsData()]);
  }, [fetchMemberPointsData, fetchProfile, session?.user?.id]);

  /** 根据当前积分与等级配置计算升级进度与剩余提示。 */
  const { progress, progressText } = useMemo(() => {
    const config = TIER_CONFIG[memberTier] ?? TIER_CONFIG["新叶会员"];
    if (!config.next) {
      return { progress: 100, progressText: "最高等级" };
    }

    const range = config.ceiling - config.floor;
    const current = Math.max(0, Math.min(points - config.floor, range));
    const pct = range > 0 ? Math.round((current / range) * 100) : 0;
    const remaining = config.ceiling - points;

    return {
      progress: Math.min(pct, 100),
      progressText: `距离${config.next}还需 ${Math.max(0, remaining)} 积分`,
    };
  }, [memberTier, points]);

  /** 只展示最近 3 条积分流水，用于个人中心头部摘要。 */
  const recentLedgerEntries = useMemo(() => getRecentLedgerEntries(3), [getRecentLedgerEntries, points]);

  /** 选择并上传头像，前置做权限与体积校验。 */
  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showModal("提示", "需要相册权限才能更换头像");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      showModal("提示", "无法读取图片数据", "error");
      return;
    }

    const approxBytes = asset.base64.length * 0.75;
    if (approxBytes > 2 * 1024 * 1024) {
      showModal("提示", "图片大小不能超过 2MB，请选择更小的图片");
      return;
    }

    const ext = asset.uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';

    setUploading(true);
    const error = await uploadAvatar(asset.base64, ext);
    setUploading(false);

    if (error) showModal("上传失败", error, "error");
  };

  const goEditProfile = () => router.push("/edit-profile");

  /** 个人中心快捷签到入口：成功后通过弹窗反馈本次奖励。 */
  const handleCheckIn = async () => {
    try {
      const result = await claimDailyCheckIn();
      if (!result.success) {
        if (result.reason === "already_completed") {
          showModal("今日已签到", "今天的签到奖励已经领取过了。", "info");
          return;
        }
        showModal("签到失败", "签到任务暂不可用，请稍后再试。", "error");
        return;
      }

      showModal(
        "签到成功",
        `获得 ${result.points_reward ?? 0} 积分，当前积分 ${result.points ?? points}`,
        "success",
      );
    } catch (error) {
      showModal("签到失败", error instanceof Error ? error.message : "请稍后重试", "error");
    }
  };

  return (
    <View className="bg-primary/5 px-6 pt-8 pb-6 gap-4">
      <View className="flex-row items-center gap-4">
        <Pressable onPress={handlePickAvatar} disabled={uploading} className="relative active:opacity-70">
          <Image
            source={avatar ? { uri: avatar } : require("@/assets/images/icon.png")}
            style={{ width: 80, height: 80, borderRadius: 9999, borderWidth: 2, borderColor: Colors.tertiary }}
            contentFit="cover"
          />
          <View className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-tertiary items-center justify-center">
            <MaterialIcons name={uploading ? "hourglass-top" : "camera-alt"} size={12} color="#fff" />
          </View>
        </Pressable>

        <View className="flex-1 gap-1">
          <Pressable onPress={goEditProfile} className="flex-row items-center gap-1.5 active:opacity-60">
            <Text className="font-headline text-xl text-on-surface font-bold">
              {displayName}
            </Text>
            <MaterialIcons name="edit" size={14} color={Colors.outline} />
          </Pressable>

          <View className="bg-tertiary self-start px-2.5 py-0.5 rounded-full">
            <Text className="text-on-tertiary text-xs font-bold">
              {memberTier}
            </Text>
          </View>
          <Pressable onPress={() => router.push(routes.points)}>
            <Text className="text-on-surface-variant text-xs mt-1">
              茶叶积分 {points.toLocaleString()} · 查看明细
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-1.5">
        <View className="flex-row justify-between">
          <Text className="text-on-surface-variant text-[10px]">
            {progressText}
          </Text>
          <Text className="text-tertiary text-[10px] font-bold">{progress}%</Text>
        </View>
        <View className="h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
          <View
            className="h-full bg-tertiary rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <View className="rounded-2xl bg-surface-container-low px-4 py-4 gap-3">
        <View className="flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-on-surface text-sm font-bold">每日签到</Text>
            <Text className="text-on-surface-variant text-xs">
              每天签到可获得 10 积分
            </Text>
          </View>
          <Pressable
            onPress={() => void handleCheckIn()}
            disabled={claiming || hasCheckedInToday()}
            className={`px-4 py-2 rounded-full ${claiming || hasCheckedInToday() ? "bg-outline-variant/30" : "bg-primary-container"}`}
          >
            <Text className={claiming || hasCheckedInToday() ? "text-outline text-xs font-medium" : "text-on-primary text-xs font-medium"}>
              {hasCheckedInToday() ? "今日已签" : claiming ? "签到中" : "去签到"}
            </Text>
          </Pressable>
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-on-surface text-sm font-bold">最近积分变动</Text>
            <Pressable onPress={() => router.push(routes.points)}>
              <Text className="text-primary text-xs font-medium">全部明细</Text>
            </Pressable>
          </View>

          {recentLedgerEntries.length > 0 ? (
            recentLedgerEntries.map((entry) => (
              <View key={entry.id} className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-on-surface text-xs font-medium">
                    {entry.remark ?? entry.task_code ?? "积分变动"}
                  </Text>
                  <Text className="text-outline text-[10px]">
                    {new Date(entry.created_at).toLocaleString("zh-CN")}
                  </Text>
                </View>
                <Text className={entry.points_delta > 0 ? "text-primary text-xs font-bold" : "text-error text-xs font-bold"}>
                  {entry.points_delta > 0 ? `+${entry.points_delta}` : entry.points_delta}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-outline text-xs">暂无积分变动，先去签到领取今日积分吧。</Text>
          )}
        </View>
      </View>
    </View>
  );
}
