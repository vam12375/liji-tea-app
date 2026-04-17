import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";
import { pushMerchantToast } from "@/stores/merchantToastStore";

// 商品库存调整面板（v4.4.0 无外壳版）：
// - 去掉自带 card 容器，由父级 BentoBlock 统一提供。
// - 输入框 / 按钮样式与其它 Dialog（圆角 12、字号 14、内边距 10）对齐。
// - 提交失败不清空输入，便于用户修正后重试。

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

  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          color: MerchantColors.ink500,
          fontSize: 11,
          letterSpacing: 0.8,
        }}
      >
        当前库存 {currentStock}
      </Text>
      <TextInput
        value={delta}
        onChangeText={setDelta}
        keyboardType="numbers-and-punctuation"
        placeholder="调整量（正数入库 / 负数出库）"
        placeholderTextColor={MerchantColors.ink500}
        style={inputStyle}
      />
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="调整原因（必填，便于审计）"
        placeholderTextColor={MerchantColors.ink500}
        style={inputStyle}
      />
      <Pressable
        disabled={!canSubmit}
        onPress={handleSubmit}
        style={({ pressed }) => [
          {
            marginTop: 2,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
            backgroundColor: canSubmit
              ? MerchantColors.statusGo
              : MerchantColors.line,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: canSubmit ? "#fff" : MerchantColors.ink500,
            fontWeight: "600",
          }}
        >
          {loading ? "提交中…" : "提交调整"}
        </Text>
      </Pressable>
    </View>
  );
}
