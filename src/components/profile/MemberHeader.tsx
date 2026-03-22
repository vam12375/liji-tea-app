import { useState, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useUserStore } from "@/stores/userStore";
import { showModal } from "@/stores/modalStore";

/**
 * 会员等级阶梯配置
 * floor: 该等级最低积分, ceiling: 升级到下一等级所需积分, next: 下一等级名称
 */
const TIER_CONFIG: Record<string, { floor: number; ceiling: number; next: string | null }> = {
  "新叶会员": { floor: 0, ceiling: 500, next: "翡翠会员" },
  "翡翠会员": { floor: 500, ceiling: 2000, next: "金叶会员" },
  "金叶会员": { floor: 2000, ceiling: 2000, next: null }, // 最高等级
};

export default function MemberHeader() {
  const { name, avatar, memberTier, points, uploadAvatar } = useUserStore();
  const router = useRouter();
  const displayName = name || "茶友";
  const [uploading, setUploading] = useState(false);

  // 根据当前等级和积分计算进度
  const { progress, progressText } = useMemo(() => {
    const config = TIER_CONFIG[memberTier] ?? TIER_CONFIG["新叶会员"];

    // 已达最高等级
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

  // 选择并上传头像
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

    // 检查文件大小（2MB 限制，base64 长度 × 0.75 ≈ 原始字节数）
    const approxBytes = asset.base64.length * 0.75;
    if (approxBytes > 2 * 1024 * 1024) {
      showModal("提示", "图片大小不能超过 2MB，请选择更小的图片");
      return;
    }

    // 推断扩展名
    const ext = asset.uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';

    setUploading(true);
    const error = await uploadAvatar(asset.base64, ext);
    setUploading(false);

    if (error) showModal("上传失败", error, "error");
  };

  // 跳转编辑资料页
  const goEditProfile = () => router.push("/edit-profile");

  return (
    <View className="bg-primary/5 px-6 pt-8 pb-6 gap-4">
      {/* 头像 + 信息 */}
      <View className="flex-row items-center gap-4">
        {/* 头像（可点击更换） */}
        <Pressable onPress={handlePickAvatar} disabled={uploading} className="relative active:opacity-70">
          <Image
            source={avatar ? { uri: avatar } : require("@/assets/images/icon.png")}
            style={{ width: 80, height: 80, borderRadius: 9999, borderWidth: 2, borderColor: Colors.tertiary }}
            contentFit="cover"
          />
          {/* 编辑角标 */}
          <View className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-tertiary items-center justify-center">
            <MaterialIcons name={uploading ? "hourglass-top" : "camera-alt"} size={12} color="#fff" />
          </View>
        </Pressable>

        <View className="flex-1 gap-1">
          {/* 用户名 + 编辑入口（Task 9） */}
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
          <Text className="text-on-surface-variant text-xs mt-1">
            茶叶积分 {points.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* 等级进度条 — 动态计算 */}
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
    </View>
  );
}
