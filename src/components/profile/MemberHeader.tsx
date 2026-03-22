import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useUserStore } from "@/stores/userStore";

export default function MemberHeader() {
  const { name, avatar, memberTier, points, uploadAvatar } = useUserStore();
  const displayName = name || "茶友";
  const progress = 89;
  const [uploading, setUploading] = useState(false);

  // 选择并上传头像
  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("提示", "需要相册权限才能更换头像");
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
      Alert.alert("提示", "无法读取图片数据");
      return;
    }

    // 检查文件大小（2MB 限制，base64 长度 × 0.75 ≈ 原始字节数）
    const approxBytes = asset.base64.length * 0.75;
    if (approxBytes > 2 * 1024 * 1024) {
      Alert.alert("提示", "图片大小不能超过 2MB，请选择更小的图片");
      return;
    }

    // 推断扩展名
    const ext = asset.uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';

    setUploading(true);
    const error = await uploadAvatar(asset.base64, ext);
    setUploading(false);

    if (error) Alert.alert("上传失败", error);
  };

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
          <Text className="font-headline text-xl text-on-surface font-bold">
            {displayName}
          </Text>
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

      {/* 等级进度条 */}
      <View className="gap-1.5">
        <View className="flex-row justify-between">
          <Text className="text-on-surface-variant text-[10px]">
            距离翡翠会员还需 320 积分
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
