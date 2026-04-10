import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { useRouter, Stack } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image as ExpoImage } from "expo-image";
import Constants from "expo-constants";
import { Colors } from "@/constants/Colors";
import { goBackOrReplace } from "@/lib/navigation";
import { useUserStore } from "@/stores/userStore";
import { showModal, showConfirm } from "@/stores/modalStore";

const APP_VERSION = Constants.expoConfig?.version ?? "2.7.0";

/** 设置项类型 */
interface SettingItem {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  type: "navigate" | "toggle";
  onPress?: () => void;
}

export default function SettingsScreen() {
  const router = useRouter();
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

  /** 隐私协议 */
  const handlePrivacy = () => {
    showModal("隐私协议", [
      "李记茶铺尊重并保护您的个人隐私。",
      "",
      "1. 我们收集的信息仅用于提供服务，包括姓名、手机号、收货地址等。",
      "2. 您的信息将通过加密传输和存储，不会出售或共享给第三方。",
      "3. 您可以随时在「设置」中修改或删除个人信息。",
      "4. 我们使用支付宝等第三方支付服务，支付信息由对方安全处理。",
      "5. 如有疑问，请联系 2898191344@qq.com。",
    ].join("\n"));
  };

  /** 关于我们 */
  const handleAbout = () => {
    showModal("关于李记茶铺", [
      "李记茶铺 v" + APP_VERSION,
      "",
      "传承中国茶文化，精选高山好茶。",
      "从茶园到茶杯，每一片茶叶都经过严格筛选。",
      "",
      "联系我们：2898191344@qq.com",
      "官方微信：13777488145",
    ].join("\n"));
  };

  /** 清除缓存 */
  const handleClearCache = () => {
    showConfirm("清除缓存", "将清除图片缓存和本地存储数据，确定继续？", async () => {
      try {
        // 清除 expo-image 图片缓存
        await ExpoImage.clearDiskCache();
        await ExpoImage.clearMemoryCache();
        // 清除 AsyncStorage（购物车等本地数据）
        await AsyncStorage.clear();
        showModal("提示", "缓存已清除，部分数据将在下次打开时重新加载", "success");
      } catch {
        showModal("提示", "清除缓存失败，请稍后重试", "error");
      }
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
      onPress: () => handlePrivacy(),
    },
    {
      icon: "info",
      label: "关于我们",
      type: "navigate",
      onPress: () => handleAbout(),
    },
    {
      icon: "delete-sweep",
      label: "清除缓存",
      type: "navigate",
      onPress: () => handleClearCache(),
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
            <Pressable onPress={() => goBackOrReplace(router)} hitSlop={8}>
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
        <Text className="text-center text-outline text-xs mt-8">v{APP_VERSION}</Text>

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
