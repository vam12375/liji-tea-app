import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

// 发货弹窗：承运商 + 运单号双输入；两项均必填才允许提交，提交中禁用按钮。
// 错误由调用方的 onSubmit Promise reject 处理（上抛给页面层 Alert），
// 本组件不承担 toast / Alert 职责，保持单一职责。

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (carrier: string, trackingNo: string) => Promise<void>;
}

export function ShipOrderDialog({ visible, onClose, onSubmit }: Props) {
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit =
    carrier.trim().length > 0 && trackingNo.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit(carrier.trim(), trackingNo.trim());
      setCarrier("");
      setTrackingNo("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full bg-surface-bright rounded-2xl p-5 gap-3">
          <Text className="text-on-surface text-lg font-semibold">
            填写发货信息
          </Text>
          <TextInput
            value={carrier}
            onChangeText={setCarrier}
            placeholder="承运商（如：顺丰、中通）"
            style={{
              borderWidth: 1,
              borderColor: "#e6dfd1",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
            }}
          />
          <TextInput
            value={trackingNo}
            onChangeText={setTrackingNo}
            placeholder="运单号"
            autoCapitalize="characters"
            style={{
              borderWidth: 1,
              borderColor: "#e6dfd1",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
            }}
          />
          <View className="flex-row justify-end gap-3 mt-2">
            <Pressable onPress={onClose} className="px-4 py-2">
              <Text className="text-on-surface-variant">取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              className={`px-4 py-2 rounded-lg ${
                canSubmit ? "bg-primary" : "bg-surface-variant"
              }`}
            >
              <Text
                className={
                  canSubmit ? "text-on-primary" : "text-on-surface-variant"
                }
              >
                {loading ? "提交中…" : "确认发货"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
