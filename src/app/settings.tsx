import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useUserStore } from "@/stores/userStore";
import { showModal, showConfirm } from "@/stores/modalStore";

/** 设置项类型 */
interface SettingItem {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  type: "navigate" | "toggle";
  onPress?: () => void;
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signOut = useUserStore((s) => s.signOut);

  // 消息通知开关本地状态
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  /** 退出登录操作 */
  const handleLogoutAction = async () => {
    await signOut();
    router.replace("/(tabs)");
  };

  /** 退出登录确认 */
  const handleLogout = () => {
    showConfirm("确认退出", "确定要退出登录吗？", handleLogoutAction, {
      icon: "logout",
      confirmText: "确认退出",
      confirmStyle: "destructive",
    });
  };

  // 设置项配置
  const settingItems: SettingItem[] = [
    {
      icon: "notifications",
      label: "消息通知",
      type: "toggle",
    },
    {
      icon: "privacy-tip",
      label: "隐私协议",
      type: "navigate",
      onPress: () => showModal("提示", "隐私协议页面即将上线"),
    },
    {
      icon: "info",
      label: "关于我们",
      type: "navigate",
      onPress: () => showModal("提示", "关于我们页面即将上线"),
    },
    {
      icon: "delete-sweep",
      label: "清除缓存",
      type: "navigate",
      onPress: () => showModal("提示", "缓存已清除", "success"),
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "设置",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-4"
        showsVerticalScrollIndicator={false}
      >
        {/* 设置项列表 */}
        {settingItems.map((item) => (
          <Pressable
            key={item.label}
            onPress={item.type === "navigate" ? item.onPress : undefined}
            className="flex-row items-center py-4 border-b border-outline-variant/10 active:bg-surface-container/50"
          >
            <MaterialIcons name={item.icon} size={20} color={Colors.onSurface} />
            <Text className="flex-1 ml-3 text-sm text-on-surface">
              {item.label}
            </Text>

            {/* 通知项使用 Switch，其余显示箭头 */}
            {item.type === "toggle" ? (
              <Switch
                value={notificationEnabled}
                onValueChange={setNotificationEnabled}
                trackColor={{ false: Colors.outlineVariant, true: Colors.primaryContainer }}
                thumbColor={notificationEnabled ? Colors.primary : Colors.outline}
              />
            ) : (
              <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
            )}
          </Pressable>
        ))}

        {/* 版本号 */}
        <Text className="text-center text-outline text-xs mt-8">v2.6.0</Text>

        {/* 退出登录按钮 */}
        <Pressable
          onPress={handleLogout}
          className="mt-6 py-3 items-center active:opacity-70"
        >
          <Text className="text-error text-sm font-medium">退出登录</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
