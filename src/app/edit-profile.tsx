import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "@/constants/Colors";
import { useUserStore } from "@/stores/userStore";

/** 编辑资料页 — 修改头像、昵称、手机号 */
export default function EditProfileScreen() {
  const router = useRouter();
  const profile = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const uploadAvatar = useUserStore((s) => s.uploadAvatar);

  // 表单本地状态（初始化自 profile）
  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);

  // 是否有修改
  const hasChanges = name !== (profile?.name ?? "") || phone !== (profile?.phone ?? "");

  /** 保存资料 */
  const handleSave = async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    const err = await updateProfile({ name, phone });
    setSaving(false);

    if (err) {
      Alert.alert("错误", err);
    } else {
      Alert.alert("提示", "资料已更新");
      router.back();
    }
  };

  /** 选择并上传头像 */
  const handlePickAvatar = async () => {
    // 请求相册权限
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

    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    // 从 URI 推断扩展名
    const ext = asset.uri.split(".").pop()?.toLowerCase() === "png" ? "png" : "jpg";

    const err = await uploadAvatar(asset.base64, ext);
    if (err) {
      Alert.alert("错误", err);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "编辑资料",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleSave} hitSlop={8} disabled={!hasChanges || saving}>
              <Text
                className={`text-sm font-medium ${
                  hasChanges && !saving ? "text-primary" : "text-outline"
                }`}
              >
                保存
              </Text>
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 头像区域 */}
          <View className="items-center mb-8">
            <Pressable onPress={handlePickAvatar} className="relative">
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: 96, height: 96, borderRadius: 48 }}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-surface-container items-center justify-center">
                  <MaterialIcons name="person" size={40} color={Colors.outline} />
                </View>
              )}
              {/* 相机图标覆盖层 */}
              <View className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5">
                <MaterialIcons name="camera-alt" size={16} color={Colors.onPrimary} />
              </View>
            </Pressable>
            <Text className="text-outline text-xs mt-2">点击更换头像</Text>
          </View>

          {/* 昵称 */}
          <View className="mb-5">
            <Text className="text-outline text-xs mb-1.5">昵称</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="请输入昵称"
              placeholderTextColor={Colors.outlineVariant}
              className="h-12 px-4 rounded-lg border border-outline-variant/30 text-on-surface text-sm bg-surface-container-low"
            />
          </View>

          {/* 手机号 */}
          <View className="mb-5">
            <Text className="text-outline text-xs mb-1.5">手机号</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="请输入手机号"
              placeholderTextColor={Colors.outlineVariant}
              keyboardType="phone-pad"
              className="h-12 px-4 rounded-lg border border-outline-variant/30 text-on-surface text-sm bg-surface-container-low"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
