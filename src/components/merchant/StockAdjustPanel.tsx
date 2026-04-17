import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { pushMerchantToast } from "@/stores/merchantToastStore";

// 商品库存调整面板：显示当前库存 + delta 输入（正加负减）+ 必填原因。
// 父组件通过 onSubmit 得到新值，失败时组件不清空输入，便于用户修正。

interface Props {
  currentStock: number;
  onSubmit: (delta: number, reason: string) => Promise<void>;
}

export function StockAdjustPanel({ currentStock, onSubmit }: Props) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const deltaNum = Number(delta);
  const canSubmit =
    !loading &&
    Number.isFinite(deltaNum) &&
    deltaNum !== 0 &&
    reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit(deltaNum, reason.trim());
      setDelta("");
      setReason("");
      pushMerchantToast({ kind: "success", title: "库存已更新" });
    } catch {
      // 父层已 push 错误 Toast，这里不清空输入，让用户可以修改后重试。
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-2 p-4 rounded-2xl bg-surface-bright">
      <Text className="text-on-surface font-semibold">库存调整</Text>
      <Text className="text-on-surface-variant text-xs">
        当前库存：{currentStock}
      </Text>
      <TextInput
        value={delta}
        onChangeText={setDelta}
        keyboardType="numbers-and-punctuation"
        placeholder="调整量（正数入库 / 负数出库）"
        className="border border-outline-variant rounded-lg px-3 py-2 text-on-surface"
      />
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="调整原因（必填，便于审计）"
        className="border border-outline-variant rounded-lg px-3 py-2 text-on-surface"
      />
      <Pressable
        disabled={!canSubmit}
        onPress={handleSubmit}
        className={`rounded-lg py-2.5 items-center mt-1 ${
          canSubmit ? "bg-primary" : "bg-surface-variant"
        }`}
      >
        <Text
          className={canSubmit ? "text-on-primary" : "text-on-surface-variant"}
        >
          {loading ? "提交中…" : "提交调整"}
        </Text>
      </Pressable>
    </View>
  );
}
