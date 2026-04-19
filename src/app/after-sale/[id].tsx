// 售后详情页：展示单条售后工单的状态、金额、原因与凭证，并承载"撤销申请"入口。
// 读写路径均通过 afterSaleStore，不直接调用 Supabase，避免重复拉取与状态漂移。
import { TeaImage } from "@/components/ui/TeaImage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { afterSaleCopy } from "@/constants/copy";
import {
  getAfterSaleReasonLabel,
  getAfterSaleStatusDescription,
  getAfterSaleStatusLabel,
} from "@/lib/afterSale";
import { formatChinaDateTime } from "@/lib/dateTime";
import { routes } from "@/lib/routes";
import { showConfirm, showModal } from "@/stores/modalStore";
import { useAfterSaleStore } from "@/stores/afterSaleStore";

// snapshot 是 JSONB，字段类型不受约束；这里做一次防御读取，缺失或非字符串时返回 fallback。
function readSnapshotString(
  snapshot: Record<string, unknown>,
  key: string,
  fallback = "--",
) {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default function AfterSaleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const currentRequest = useAfterSaleStore((state) =>
    id && state.currentRequest?.id === id ? state.currentRequest : null,
  );
  const loading = useAfterSaleStore((state) => state.loading);
  const canceling = useAfterSaleStore((state) => state.canceling);
  const fetchRequestById = useAfterSaleStore((state) => state.fetchRequestById);
  const cancelRequest = useAfterSaleStore((state) => state.cancelRequest);

  useEffect(() => {
    if (!id) {
      return;
    }

    void fetchRequestById(id).catch(() => undefined);
  }, [fetchRequestById, id]);

  if (!id) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={afterSaleCopy.titles.detail} />
        <ScreenState
          variant="empty"
          title="缺少售后申请信息"
          description="请从订单或通知入口重新进入。"
        />
      </View>
    );
  }

  if (loading && !currentRequest) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={afterSaleCopy.titles.detail} />
        <ScreenState variant="loading" title="正在加载售后进度..." />
      </View>
    );
  }

  if (!currentRequest) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={afterSaleCopy.titles.detail} />
        <ScreenState
          variant="empty"
          title="售后申请不存在"
          description="当前售后申请不存在，或您暂无权限查看。"
          actionLabel="返回订单"
          onAction={() => router.replace(routes.orders)}
        />
      </View>
    );
  }

  const canCancel =
    currentRequest.status === "submitted" ||
    currentRequest.status === "pending_review";

  const handleCancel = () => {
    showConfirm(
      "撤销申请",
      "确认要撤销这笔退款申请吗？",
      async () => {
        try {
          await cancelRequest(currentRequest.id);
          showModal("已撤销", afterSaleCopy.messages.cancelSuccess, "success");
        } catch (error) {
          showModal(
            "撤销失败",
            error instanceof Error ? error.message : "请稍后重试",
            "error",
          );
        }
      },
      {
        confirmText: canceling ? "撤销中" : afterSaleCopy.actions.cancel,
      },
    );
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={afterSaleCopy.titles.detail} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3 rounded-2xl bg-surface-container-low p-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-base font-bold text-on-surface">
              当前状态
            </Text>
            <View className="rounded-full bg-primary/10 px-3 py-1">
              <Text className="text-xs font-medium text-primary">
                {getAfterSaleStatusLabel(currentRequest.status)}
              </Text>
            </View>
          </View>
          <Text className="text-sm leading-6 text-on-surface-variant">
            {getAfterSaleStatusDescription(currentRequest.status)}
          </Text>
        </View>

        <View className="gap-2 rounded-2xl bg-surface-container-low p-4">
          <Text className="text-base font-bold text-on-surface">申请信息</Text>
          <Text className="text-sm text-on-surface-variant">
            {afterSaleCopy.labels.orderNumber}：
            {readSnapshotString(currentRequest.snapshot, "orderNo", currentRequest.order_id.slice(-8))}
          </Text>
          <Text className="text-sm text-on-surface-variant">
            {afterSaleCopy.labels.requestedAmount}：¥
            {currentRequest.requested_amount.toFixed(2)}
          </Text>
          {typeof currentRequest.approved_amount === "number" ? (
            <Text className="text-sm text-on-surface-variant">
              {afterSaleCopy.labels.approvedAmount}：¥
              {currentRequest.approved_amount.toFixed(2)}
            </Text>
          ) : null}
          <Text className="text-sm text-on-surface-variant">
            {afterSaleCopy.labels.reason}：
            {getAfterSaleReasonLabel(currentRequest.reason_code)}
          </Text>
          {currentRequest.reason_text ? (
            <Text className="text-sm leading-6 text-on-surface-variant">
              {afterSaleCopy.labels.description}：{currentRequest.reason_text}
            </Text>
          ) : null}
        </View>

        <View className="gap-2 rounded-2xl bg-surface-container-low p-4">
          <Text className="text-base font-bold text-on-surface">时间节点</Text>
          <Text className="text-sm text-on-surface-variant">
            {afterSaleCopy.labels.submittedAt}：
            {formatChinaDateTime(currentRequest.submitted_at)}
          </Text>
          {currentRequest.reviewed_at ? (
            <Text className="text-sm text-on-surface-variant">
              {afterSaleCopy.labels.reviewedAt}：
              {formatChinaDateTime(currentRequest.reviewed_at)}
            </Text>
          ) : null}
          {currentRequest.refunded_at ? (
            <Text className="text-sm text-on-surface-variant">
              {afterSaleCopy.labels.refundedAt}：
              {formatChinaDateTime(currentRequest.refunded_at)}
            </Text>
          ) : null}
        </View>

        {currentRequest.audit_note || currentRequest.refund_note ? (
          <View className="gap-2 rounded-2xl bg-surface-container-low p-4">
            <Text className="text-base font-bold text-on-surface">处理说明</Text>
            {currentRequest.audit_note ? (
              <Text className="text-sm leading-6 text-on-surface-variant">
                审核备注：{currentRequest.audit_note}
              </Text>
            ) : null}
            {currentRequest.refund_note ? (
              <Text className="text-sm leading-6 text-on-surface-variant">
                退款备注：{currentRequest.refund_note}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="gap-3 rounded-2xl bg-surface-container-low p-4">
          <Text className="text-base font-bold text-on-surface">
            {afterSaleCopy.labels.evidences}
          </Text>

          {currentRequest.evidences && currentRequest.evidences.length > 0 ? (
            <View className="flex-row flex-wrap gap-3">
              {currentRequest.evidences.map((item) => (
                <View key={item.id} className="gap-1">
                  {item.display_url ? (
                    <TeaImage
                      source={{ uri: item.display_url }}
                      style={{ width: 88, height: 88, borderRadius: 16 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="h-[88px] w-[88px] items-center justify-center rounded-2xl bg-background">
                      <Text className="text-[10px] text-outline">图片已过期</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-on-surface-variant">暂无凭证图片</Text>
          )}
        </View>

        <Pressable
          onPress={() => router.push(routes.tracking(currentRequest.order_id))}
          className="items-center justify-center rounded-full border border-outline-variant py-3 active:opacity-70"
        >
          <Text className="font-medium text-on-surface">
            {afterSaleCopy.actions.viewOrder}
          </Text>
        </Pressable>

        {canCancel ? (
          <Pressable
            onPress={handleCancel}
            className="items-center justify-center rounded-full bg-primary-container py-3 active:bg-primary"
          >
            <Text className="font-medium text-on-primary">
              {canceling ? "撤销中..." : afterSaleCopy.actions.cancel}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
