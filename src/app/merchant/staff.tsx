import { Redirect } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { MerchantBentoBlock } from "@/components/merchant/MerchantBentoBlock";
import { MerchantScreenHeader } from "@/components/merchant/MerchantScreenHeader";
import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { MerchantColors } from "@/constants/MerchantColors";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { merchantRpc } from "@/lib/merchantRpc";
import { pushMerchantToast } from "@/stores/merchantToastStore";
import { useUserStore } from "@/stores/userStore";

// 员工管理页（v4.4.0 Bento 重排）：仅 admin 可用。
// - 说明段包在"使用说明"Bento；输入 + 三按钮包在"授权动作"Bento。
// - 输入框圆角 12 与 Dialog 对齐；按钮按压 scale 0.98 + opacity 0.85。
// - Alert 已在 Task 9 迁至 Toast。
export default function MerchantStaffScreen() {
  const role = useUserStore((s) => s.role);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);

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

  const inputStyle = {
    borderWidth: 1,
    borderColor: MerchantColors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    color: MerchantColors.ink900,
  } as const;

  const primaryBtn = (pressed: boolean, disabled: boolean) => ({
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center" as const,
    backgroundColor: disabled ? MerchantColors.line : MerchantColors.statusGo,
    opacity: pressed ? 0.85 : 1,
    transform: [{ scale: pressed ? 0.98 : 1 }],
  });

  return (
    <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="staff" showStaff />
      <MerchantScreenHeader title="员工管理" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <MerchantBentoBlock title="使用说明">
          <Text
            style={{
              color: MerchantColors.ink500,
              fontSize: 12,
              lineHeight: 20,
            }}
          >
            仅 admin 可用。输入目标 Supabase user_id（auth.users.id UUID），
            再选择动作；操作会被写入 merchant_audit_logs，可在 Supabase
            Dashboard 查询。
          </Text>
        </MerchantBentoBlock>

        <MerchantBentoBlock title="授权动作">
          <TextInput
            value={userId}
            onChangeText={setUserId}
            placeholder="目标 user_id"
            placeholderTextColor={MerchantColors.ink500}
            autoCapitalize="none"
            style={inputStyle}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              disabled={busy}
              onPress={() => call("staff")}
              style={({ pressed }) => [primaryBtn(pressed, busy)]}
            >
              <Text
                style={{
                  color: busy ? MerchantColors.ink500 : "#fff",
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                设为 staff
              </Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => call("admin")}
              style={({ pressed }) => [primaryBtn(pressed, busy)]}
            >
              <Text
                style={{
                  color: busy ? MerchantColors.ink500 : "#fff",
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                设为 admin
              </Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => call(null)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  borderWidth: 1,
                  borderColor: MerchantColors.line,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  color: MerchantColors.ink900,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                撤销
              </Text>
            </Pressable>
          </View>
        </MerchantBentoBlock>
      </ScrollView>
    </View>
  );
}
