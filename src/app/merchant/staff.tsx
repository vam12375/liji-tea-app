import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { merchantRpc } from "@/lib/merchantRpc";
import { pushMerchantToast } from "@/stores/merchantToastStore";
import { useUserStore } from "@/stores/userStore";
import { Redirect } from "expo-router";

// 员工管理页：仅 admin 可用。
// MVP 保持最简：输入 user_id（auth.users.id UUID），选择设为 staff / admin / 撤销。
// 具体用户检索（邮箱搜索、分页列表）留给 V2，避免 MVP 首版过重。
export default function MerchantStaffScreen() {
  const role = useUserStore((s) => s.role);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);

  // 防御性兜底：非 admin 不应到达此页；_layout 已守卫但加这一层保险。
  if (role !== "admin") {
    return <Redirect href="/(tabs)" />;
  }

  const call = async (target: "admin" | "staff" | null) => {
    const trimmed = userId.trim();
    if (!trimmed) {
      pushMerchantToast({ kind: "error", title: "请先输入 user_id" });
      return;
    }
    setBusy(true);
    try {
      await merchantRpc.grantRole(trimmed, target);
      pushMerchantToast({
        kind: "success",
        title: target ? `已设置为 ${target}` : "已撤销员工身份",
      });
    } catch (err) {
      pushMerchantToast({
        kind: "error",
        title: "操作失败",
        detail: classifyMerchantError(err).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="staff" showStaff />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="text-on-surface-variant text-xs leading-5">
          仅 admin 可用。输入目标 Supabase user_id（auth.users.id UUID），
          再选择动作；操作会被写入 merchant_audit_logs，可在 Supabase
          Dashboard 查询。
        </Text>
        <TextInput
          value={userId}
          onChangeText={setUserId}
          placeholder="目标 user_id"
          autoCapitalize="none"
          className="border border-outline-variant rounded-lg px-3 py-2 text-on-surface"
        />
        <View className="flex-row gap-3">
          <Pressable
            disabled={busy}
            onPress={() => call("staff")}
            className={`flex-1 rounded-lg py-3 items-center ${
              busy ? "bg-surface-variant" : "bg-primary"
            }`}
          >
            <Text className={busy ? "text-on-surface-variant" : "text-on-primary"}>
              设为 staff
            </Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => call("admin")}
            className={`flex-1 rounded-lg py-3 items-center ${
              busy ? "bg-surface-variant" : "bg-primary"
            }`}
          >
            <Text className={busy ? "text-on-surface-variant" : "text-on-primary"}>
              设为 admin
            </Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => call(null)}
            className="flex-1 border border-outline rounded-lg py-3 items-center"
          >
            <Text className="text-on-surface">撤销</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
