import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import {
  AfterSaleActionSheet,
  type AfterSaleAction,
} from "@/components/merchant/AfterSaleActionSheet";
import { AppHeader } from "@/components/ui/AppHeader";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { useMerchantStore } from "@/stores/merchantStore";

// 售后详情页：按当前 status 分支渲染可用操作。
// - submitted/pending_review/auto_approved → 同意 / 拒绝
// - approved/refunding → 标记已打款
// 三种动作共用一个 ActionSheet，由 action 控制输入项。
export default function MerchantAfterSaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useMerchantStore((s) => s.afterSales);
  const approve = useMerchantStore((s) => s.approveRefund);
  const reject = useMerchantStore((s) => s.rejectRefund);
  const complete = useMerchantStore((s) => s.markRefundCompleted);

  const request = useMemo(
    () => list.find((r) => r.id === id),
    [list, id],
  );
  const [action, setAction] = useState<AfterSaleAction | null>(null);

  if (!request) {
    return (
      <View className="flex-1 bg-surface">
        <AppHeader title="售后详情" showBackButton />
        <View className="flex-1 items-center justify-center">
          <Text className="text-on-surface-variant">申请不存在或未加载</Text>
        </View>
      </View>
    );
  }

  const handleSubmit = async ({
    amount,
    text,
  }: {
    amount?: number;
    text: string;
  }) => {
    try {
      if (action === "approve") await approve(request.id, amount ?? 0, text);
      if (action === "reject") await reject(request.id, text);
      if (action === "complete") await complete(request.id, text);
      Alert.alert("操作成功");
    } catch (err) {
      Alert.alert("操作失败", classifyMerchantError(err).message);
      throw err;
    }
  };

  const canApproveOrReject = [
    "submitted",
    "pending_review",
    "auto_approved",
  ].includes(request.status);
  const canComplete = ["approved", "refunding"].includes(request.status);

  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="售后详情" showBackButton />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="text-on-surface font-semibold">申请 ID：{request.id}</Text>
        <Text className="text-on-surface-variant text-sm">状态：{request.status}</Text>
        <Text className="text-on-surface-variant text-sm">订单：{request.order_id}</Text>
        <Text className="text-on-surface-variant text-sm">
          诉求金额：¥{request.requested_amount}
        </Text>
        {request.approved_amount != null ? (
          <Text className="text-on-surface-variant text-sm">
            审核金额：¥{request.approved_amount}
          </Text>
        ) : null}
        <Text className="text-on-surface-variant text-sm">
          原因：{request.reason_code}
          {request.reason_text ? ` · ${request.reason_text}` : ""}
        </Text>
        {request.audit_note ? (
          <Text className="text-on-surface-variant text-sm">
            商家备注：{request.audit_note}
          </Text>
        ) : null}
        {request.refund_txn_id ? (
          <Text className="text-on-surface-variant text-sm">
            退款交易号：{request.refund_txn_id}
          </Text>
        ) : null}

        <View className="flex-row gap-3 mt-4 flex-wrap">
          {canApproveOrReject ? (
            <>
              <Pressable
                onPress={() => setAction("approve")}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-on-primary font-medium">同意退款</Text>
              </Pressable>
              <Pressable
                onPress={() => setAction("reject")}
                className="flex-1 border border-outline rounded-lg py-3 items-center"
              >
                <Text className="text-on-surface">拒绝</Text>
              </Pressable>
            </>
          ) : null}
          {canComplete ? (
            <Pressable
              onPress={() => setAction("complete")}
              className="flex-1 bg-primary rounded-lg py-3 items-center"
            >
              <Text className="text-on-primary font-medium">标记已打款</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <AfterSaleActionSheet
        visible={action !== null}
        action={action}
        defaultAmount={request.requested_amount}
        onClose={() => setAction(null)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
