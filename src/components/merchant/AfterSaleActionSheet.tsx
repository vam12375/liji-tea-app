import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

// 售后动作表单：同一组件承载三种动作，根据 action prop 切换输入项。
// - approve: 必填退款金额 + 可选备注
// - reject:  必填拒绝理由
// - complete:必填第三方退款交易号

export type AfterSaleAction = "approve" | "reject" | "complete";

interface Props {
  visible: boolean;
  action: AfterSaleAction | null;
  defaultAmount?: number | null;
  onClose: () => void;
  onSubmit: (payload: { amount?: number; text: string }) => Promise<void>;
}

export function AfterSaleActionSheet({
  visible,
  action,
  defaultAmount,
  onClose,
  onSubmit,
}: Props) {
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  // 每次打开重置金额输入为默认值（诉求金额），并清空文本。
  useEffect(() => {
    if (visible && action) {
      setAmount(defaultAmount != null ? String(defaultAmount) : "");
      setText("");
    }
  }, [visible, action, defaultAmount]);

  if (!action) return null;

  const title =
    action === "approve"
      ? "同意退款"
      : action === "reject"
      ? "拒绝申请"
      : "标记已打款";

  const placeholder =
    action === "approve"
      ? "备注（可选）"
      : action === "reject"
      ? "请填写拒绝理由（必填）"
      : "第三方退款交易号（必填）";

  const canSubmit = (() => {
    if (loading) return false;
    if (action === "approve") return Number(amount) > 0;
    return text.trim().length > 0;
  })();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit({
        amount: action === "approve" ? Number(amount) : undefined,
        text: text.trim(),
      });
      setAmount("");
      setText("");
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
          <Text className="text-on-surface text-lg font-semibold">{title}</Text>

          {action === "approve" ? (
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="实际退款金额"
              className="border border-outline-variant rounded-lg px-3 py-2 text-on-surface"
            />
          ) : null}

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            multiline={action !== "complete"}
            className="border border-outline-variant rounded-lg px-3 py-2 text-on-surface"
          />

          <View className="flex-row justify-end gap-3 mt-2">
            <Pressable onPress={onClose} className="px-4 py-2">
              <Text className="text-on-surface-variant">取消</Text>
            </Pressable>
            <Pressable
              disabled={!canSubmit}
              onPress={handleSubmit}
              className={`px-4 py-2 rounded-lg ${
                canSubmit ? "bg-primary" : "bg-surface-variant"
              }`}
            >
              <Text
                className={
                  canSubmit ? "text-on-primary" : "text-on-surface-variant"
                }
              >
                {loading ? "提交中…" : "确认"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
