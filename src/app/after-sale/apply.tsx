// 售后申请发起页：承载"选择原因 + 补充说明 + 上传凭证 + 提交"四步表单。
// 表单状态全部放在页面内，提交成功后由 afterSaleStore 统一拉回详情再跳转到售后详情页。
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { afterSaleCopy } from "@/constants/copy";
import {
  AFTER_SALE_REASON_OPTIONS,
  canApplyAfterSale,
} from "@/lib/afterSale";
import { routes } from "@/lib/routes";
import { showModal } from "@/stores/modalStore";
import { useAfterSaleStore } from "@/stores/afterSaleStore";
import { useOrderStore } from "@/stores/orderStore";

interface SelectedEvidence {
  // 本地选择的凭证快照：uri 用于预览，base64 用于上传，ext 决定 MIME。
  uri: string;
  base64: string;
  ext: string;
}

function getDisplayOrderCode(orderId: string, orderNo?: string | null) {
  return orderNo ?? orderId.slice(-8);
}

export default function AfterSaleApplyScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const fetchOrderById = useOrderStore((state) => state.fetchOrderById);
  const order = useOrderStore((state) =>
    orderId ? state.orderByIdMap[orderId] ?? null : null,
  );
  const orderLoading = useOrderStore((state) =>
    orderId ? Boolean(state.orderLoadingById[orderId]) : false,
  );
  const existingRequest = useAfterSaleStore((state) =>
    orderId ? state.requestByOrderId[orderId] ?? null : null,
  );
  const fetchRequestByOrderId = useAfterSaleStore(
    (state) => state.fetchRequestByOrderId,
  );
  const createRequest = useAfterSaleStore((state) => state.createRequest);
  const uploadEvidence = useAfterSaleStore((state) => state.uploadEvidence);
  const submitting = useAfterSaleStore((state) => state.submitting);
  const uploading = useAfterSaleStore((state) => state.uploading);

  const [reasonCode, setReasonCode] = useState("");
  const [description, setDescription] = useState("");
  const [evidences, setEvidences] = useState<SelectedEvidence[]>([]);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    if (!order) {
      void fetchOrderById(orderId);
    }

    void fetchRequestByOrderId(orderId).catch(() => undefined);
  }, [fetchOrderById, fetchRequestByOrderId, order, orderId]);

  const handlePickEvidence = async () => {
    if (evidences.length >= 3) {
      showModal("已达上限", "最多上传 3 张凭证图片。", "info");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      showModal("无法上传", afterSaleCopy.messages.uploadPermissionDenied, "error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) {
      showModal("无法上传", afterSaleCopy.messages.uploadFailed, "error");
      return;
    }

    const ext =
      asset.fileName?.split(".").pop()?.toLowerCase() ||
      asset.mimeType?.split("/").pop()?.toLowerCase() ||
      "jpg";

    setEvidences((state) => [
      ...state,
      {
        uri: asset.uri,
        base64,
        ext,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!orderId || !order) {
      return;
    }

    if (!reasonCode) {
      showModal("无法提交", afterSaleCopy.messages.needReason, "error");
      return;
    }

    try {
      const request = await createRequest({
        orderId,
        reasonCode,
        reasonText: description,
      });

      let uploadFailed = false;
      for (const [index, item] of evidences.entries()) {
        try {
          await uploadEvidence({
            requestId: request.id,
            base64: item.base64,
            ext: item.ext,
            sortOrder: index,
          });
        } catch {
          uploadFailed = true;
        }
      }

      showModal(
        "申请已提交",
        uploadFailed
          ? "退款申请已提交，但部分凭证上传失败。"
          : afterSaleCopy.messages.applySuccess,
        "success",
      );
      router.replace(routes.afterSaleDetail(request.id));
    } catch (error) {
      showModal(
        "提交失败",
        error instanceof Error ? error.message : "请稍后重试",
        "error",
      );
    }
  };

  if (!orderId) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={afterSaleCopy.titles.apply} />
        <ScreenState
          variant="empty"
          title="缺少订单信息"
          description="请从订单详情页重新进入退款申请流程。"
        />
      </View>
    );
  }

  if (orderLoading && !order) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={afterSaleCopy.titles.apply} />
        <ScreenState variant="loading" title="正在加载订单..." />
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={afterSaleCopy.titles.apply} />
        <ScreenState
          variant="empty"
          title="订单不存在"
          description="当前订单不存在，或暂时无法读取。"
          actionLabel="返回订单"
          onAction={() => router.replace(routes.orders)}
        />
      </View>
    );
  }

  if (existingRequest) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={afterSaleCopy.titles.apply} />
        <ScreenState
          variant="empty"
          title="该订单已有售后申请"
          description="当前订单已存在售后记录，请直接查看处理进度。"
          actionLabel="查看进度"
          onAction={() => router.replace(routes.afterSaleDetail(existingRequest.id))}
        />
      </View>
    );
  }

  if (!canApplyAfterSale(order)) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={afterSaleCopy.titles.apply} />
        <ScreenState
          variant="empty"
          title="当前订单暂不支持退款申请"
          description="待支付、已取消或已完成退款的订单，当前无法再次发起退款。"
          actionLabel="返回订单"
          onAction={() => router.replace(routes.tracking(order.id))}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={afterSaleCopy.titles.apply} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2 rounded-2xl bg-surface-container-low p-4">
          <Text className="text-base font-bold text-on-surface">订单信息</Text>
          <Text className="text-sm text-on-surface-variant">
            {afterSaleCopy.labels.orderNumber}：
            {getDisplayOrderCode(order.id, order.order_no)}
          </Text>
          <Text className="text-sm text-on-surface-variant">
            {afterSaleCopy.labels.requestedAmount}：¥{order.total.toFixed(2)}
          </Text>
        </View>

        <View className="gap-3 rounded-2xl bg-surface-container-low p-4">
          <Text className="text-base font-bold text-on-surface">
            {afterSaleCopy.labels.reason}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {AFTER_SALE_REASON_OPTIONS.map((item) => {
              const active = reasonCode === item.code;
              return (
                <Pressable
                  key={item.code}
                  onPress={() => setReasonCode(item.code)}
                  className={`rounded-full px-4 py-2 ${
                    active
                      ? "bg-primary-container"
                      : "bg-background"
                  }`}
                >
                  <Text
                    className={
                      active ? "text-on-primary text-xs font-medium" : "text-on-surface text-xs"
                    }
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-3 rounded-2xl bg-surface-container-low p-4">
          <Text className="text-base font-bold text-on-surface">
            {afterSaleCopy.labels.description}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="请补充商品异常、配送问题或其他需要说明的情况"
            className="min-h-[120px] rounded-2xl bg-background px-4 py-4 text-sm text-on-surface"
            multiline
            textAlignVertical="top"
          />
        </View>

        <View className="gap-3 rounded-2xl bg-surface-container-low p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-on-surface">
              {afterSaleCopy.labels.evidences}
            </Text>
            <Text className="text-xs text-outline">{evidences.length}/3</Text>
          </View>

          <View className="flex-row flex-wrap gap-3">
            {evidences.map((item, index) => (
              <View key={`${item.uri}-${index}`} className="relative">
                <Image
                  source={{ uri: item.uri }}
                  style={{ width: 88, height: 88, borderRadius: 16 }}
                  contentFit="cover"
                />
                <Pressable
                  onPress={() =>
                    setEvidences((state) =>
                      state.filter((_, imageIndex) => imageIndex !== index),
                    )
                  }
                  className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-black/70"
                >
                  <Text className="text-xs text-white">×</Text>
                </Pressable>
              </View>
            ))}

            {evidences.length < 3 ? (
              <Pressable
                onPress={handlePickEvidence}
                className="h-[88px] w-[88px] items-center justify-center rounded-2xl border border-dashed border-outline-variant bg-background"
              >
                <Text className="text-xs text-outline">上传凭证</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || uploading}
          className="items-center justify-center rounded-full bg-primary-container py-4 active:bg-primary"
        >
          <Text className="font-medium text-on-primary">
            {submitting || uploading
              ? "正在提交..."
              : afterSaleCopy.actions.submit}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
