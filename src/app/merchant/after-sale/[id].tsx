import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  AfterSaleActionSheet,
  type AfterSaleAction,
} from "@/components/merchant/AfterSaleActionSheet";
import { MerchantBentoBlock } from "@/components/merchant/MerchantBentoBlock";
import { MerchantStatusBadge } from "@/components/merchant/MerchantStatusBadge";
import { MerchantStickyActions } from "@/components/merchant/MerchantStickyActions";
import { AppHeader } from "@/components/ui/AppHeader";
import { MerchantColors } from "@/constants/MerchantColors";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { afterSaleStatusToTone } from "@/lib/merchantFilters";
import { pushMerchantToast } from "@/stores/merchantToastStore";
import { useMerchantStore } from "@/stores/merchantStore";

// 售后详情（v4.4.0 Bento 重排）：身份段 + 原因 / 订单关联 / 商家备注 三块 Bento +
// 底部 sticky 操作条（按状态条件渲染"同意/拒绝"或"标记已打款"）。
const STATUS_LABEL: Record<string, string> = {
  submitted: "待审核",
  pending_review: "待审核",
  auto_approved: "待审核",
  approved: "已同意",
  rejected: "已拒绝",
  refunding: "退款中",
  refunded: "已完成",
  cancelled: "已取消",
};

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return value;
  }
}

export default function MerchantAfterSaleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useMerchantStore((s) => s.afterSales);
  const approve = useMerchantStore((s) => s.approveRefund);
  const reject = useMerchantStore((s) => s.rejectRefund);
  const complete = useMerchantStore((s) => s.markRefundCompleted);

  const request = useMemo(() => list.find((r) => r.id === id), [list, id]);
  const [action, setAction] = useState<AfterSaleAction | null>(null);

  if (!request) {
    return (
      <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
        <AppHeader title="售后详情" showBackButton />
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: MerchantColors.ink500 }}>申请不存在或未加载</Text>
        </View>
      </View>
    );
  }

  const tone = afterSaleStatusToTone(request.status);
  const label = STATUS_LABEL[request.status] ?? request.status;
  const canApproveOrReject = [
    "submitted",
    "pending_review",
    "auto_approved",
  ].includes(request.status);
  const canComplete = ["approved", "refunding"].includes(request.status);
  const hasAction = canApproveOrReject || canComplete;

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
      pushMerchantToast({ kind: "success", title: "操作成功" });
    } catch (err) {
      pushMerchantToast({
        kind: "error",
        title: "操作失败",
        detail: classifyMerchantError(err).message,
      });
      throw err;
    }
  };

  const evidenceCount = request.evidences?.length ?? 0;

  return (
    <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
      <AppHeader title="售后详情" showBackButton />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          paddingBottom: hasAction ? 96 : 24,
        }}
      >
        {/* 身份段 */}
        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: MerchantColors.ink500,
              fontSize: 11,
              letterSpacing: 0.8,
            }}
          >
            申请 · {request.id.slice(0, 8)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <MerchantStatusBadge tone={tone} label={label} size="md" />
            <Text
              style={{
                color: MerchantColors.ink900,
                fontFamily: "NotoSerifSC_700Bold",
                fontSize: 28,
                lineHeight: 34,
              }}
            >
              {label}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 12,
              marginTop: 2,
            }}
          >
            <Text
              style={{
                color: MerchantColors.ink900,
                fontSize: 20,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              ¥{request.requested_amount}
            </Text>
            <Text style={{ color: MerchantColors.ink500, fontSize: 12 }}>
              提交 {formatDateTime(request.submitted_at ?? request.created_at) ?? "-"}
            </Text>
          </View>
          {request.approved_amount != null &&
          request.approved_amount !== request.requested_amount ? (
            <Text style={{ color: MerchantColors.ink500, fontSize: 12 }}>
              审核金额 ¥{request.approved_amount}
            </Text>
          ) : null}
        </View>

        {/* Bento：原因 */}
        <MerchantBentoBlock title="原因">
          <Text style={{ color: MerchantColors.ink900, fontSize: 14 }}>
            {request.reason_code}
          </Text>
          {request.reason_text ? (
            <Text
              style={{
                color: MerchantColors.ink500,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              {request.reason_text}
            </Text>
          ) : null}
          {evidenceCount > 0 ? (
            <Text style={{ color: MerchantColors.ink500, fontSize: 11 }}>
              含 {evidenceCount} 张凭证 · 请到 Supabase Dashboard 查看
            </Text>
          ) : null}
        </MerchantBentoBlock>

        {/* Bento：订单关联（可点跳订单详情） */}
        <MerchantBentoBlock title="订单关联">
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/merchant/orders/[id]",
                params: { id: request.order_id },
              } as never)
            }
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: MerchantColors.ink900, fontSize: 14 }}>
              订单 {request.order?.order_no ?? request.order_id.slice(0, 8)}
            </Text>
            <Text
              style={{
                color: MerchantColors.ink500,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              查看原订单 →
            </Text>
          </Pressable>
        </MerchantBentoBlock>

        {/* Bento：商家备注（审核意见 / 打款交易号），仅在有数据时展示 */}
        {request.audit_note || request.refund_txn_id ? (
          <MerchantBentoBlock title="商家备注">
            {request.audit_note ? (
              <Text
                style={{
                  color: MerchantColors.ink900,
                  fontSize: 13,
                  lineHeight: 18,
                }}
              >
                {request.audit_note}
              </Text>
            ) : null}
            {request.refund_txn_id ? (
              <Text
                style={{
                  color: MerchantColors.ink500,
                  fontSize: 12,
                  fontVariant: ["tabular-nums"],
                }}
              >
                退款交易号 {request.refund_txn_id}
              </Text>
            ) : null}
          </MerchantBentoBlock>
        ) : null}
      </ScrollView>

      {hasAction ? (
        <MerchantStickyActions>
          {canApproveOrReject ? (
            <>
              <Pressable
                onPress={() => setAction("reject")}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    borderWidth: 1,
                    borderColor: MerchantColors.line,
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ color: MerchantColors.ink900, fontWeight: "600" }}>
                  拒绝
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAction("approve")}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: MerchantColors.statusGo,
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: "center",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>同意</Text>
              </Pressable>
            </>
          ) : null}
          {canComplete ? (
            <Pressable
              onPress={() => setAction("complete")}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: MerchantColors.statusGo,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>标记已打款</Text>
            </Pressable>
          ) : null}
        </MerchantStickyActions>
      ) : null}

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
