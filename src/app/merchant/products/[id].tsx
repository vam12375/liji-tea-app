import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { MerchantBentoBlock } from "@/components/merchant/MerchantBentoBlock";
import { MerchantStatusBadge } from "@/components/merchant/MerchantStatusBadge";
import { StockAdjustPanel } from "@/components/merchant/StockAdjustPanel";
import { AppHeader } from "@/components/ui/AppHeader";
import { MerchantColors } from "@/constants/MerchantColors";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { LOW_STOCK_THRESHOLD } from "@/lib/merchantFilters";
import { pushMerchantToast } from "@/stores/merchantToastStore";
import { useMerchantStore } from "@/stores/merchantStore";

// 商品详情/编辑（v4.4.0 Bento 重排）：
// 身份段 + 基本信息 Bento + 库存调整 Bento。StickyActions 本模块不用
// （保存按钮语义强绑在基本信息内部，不适合抽离底部）。
export default function MerchantProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const products = useMerchantStore((s) => s.products);
  const updateProduct = useMerchantStore((s) => s.updateProduct);
  const updateStock = useMerchantStore((s) => s.updateStock);

  const product = useMemo(
    () => products.find((p) => p.id === id),
    [products, id],
  );

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setName(product.name ?? "");
    setPrice(String(product.price ?? ""));
    setDescription(product.description ?? "");
    setIsActive(product.is_active !== false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (!product) {
    return (
      <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
        <AppHeader title="商品编辑" showBackButton />
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: MerchantColors.ink500 }}>商品不存在或未加载</Text>
        </View>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim() || Number.isNaN(Number(price))) {
      pushMerchantToast({
        kind: "error",
        title: "请填写合法的名称与价格",
      });
      return;
    }
    setSaving(true);
    try {
      await updateProduct(product.id, {
        name: name.trim(),
        price: Number(price),
        description,
        is_active: isActive,
      });
      pushMerchantToast({ kind: "success", title: "保存成功" });
    } catch (err) {
      pushMerchantToast({
        kind: "error",
        title: "保存失败",
        detail: classifyMerchantError(err).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStock = async (delta: number, reason: string) => {
    try {
      await updateStock(product.id, delta, reason);
    } catch (err) {
      pushMerchantToast({
        kind: "error",
        title: "调整失败",
        detail: classifyMerchantError(err).message,
      });
      throw err;
    }
  };

  const stock = product.stock ?? 0;
  const low = stock < LOW_STOCK_THRESHOLD;

  // 输入框通用样式：与 Dialog 的圆角 12 / 字号 14 / 内边距 10 对齐。
  const inputStyle = {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: MerchantColors.line,
    backgroundColor: "#fff",
    color: MerchantColors.ink900,
  } as const;

  return (
    <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
      <AppHeader title="商品编辑" showBackButton />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {/* 身份段 */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MerchantStatusBadge
              tone={isActive ? "go" : "done"}
              label={isActive ? "在架" : "下架"}
            />
            {low ? <MerchantStatusBadge tone="wait" label="低库存" /> : null}
          </View>
          <Text
            style={{
              color: MerchantColors.ink900,
              fontFamily: "NotoSerifSC_700Bold",
              fontSize: 26,
              lineHeight: 34,
            }}
            numberOfLines={2}
          >
            {product.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 14 }}>
            <Text
              style={{
                color: MerchantColors.ink900,
                fontFamily: "NotoSerifSC_700Bold",
                fontSize: 32,
                lineHeight: 36,
                fontVariant: ["tabular-nums"],
              }}
            >
              {stock}
            </Text>
            <Text
              style={{
                color: MerchantColors.ink500,
                fontSize: 11,
                letterSpacing: 0.8,
              }}
            >
              当前库存
            </Text>
          </View>
        </View>

        {/* Bento：基本信息 */}
        <MerchantBentoBlock title="基本信息">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="商品名"
            placeholderTextColor={MerchantColors.ink500}
            style={inputStyle}
          />
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="价格"
            placeholderTextColor={MerchantColors.ink500}
            style={inputStyle}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="描述"
            placeholderTextColor={MerchantColors.ink500}
            multiline
            style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 2,
            }}
          >
            <Text style={{ color: MerchantColors.ink900, fontSize: 14 }}>
              上架状态
            </Text>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>
          <Pressable
            disabled={saving}
            onPress={handleSave}
            style={({ pressed }) => [
              {
                marginTop: 4,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
                backgroundColor: saving
                  ? MerchantColors.line
                  : MerchantColors.statusGo,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: saving ? MerchantColors.ink500 : "#fff",
                fontWeight: "600",
              }}
            >
              {saving ? "保存中…" : "保存基本信息"}
            </Text>
          </Pressable>
        </MerchantBentoBlock>

        {/* Bento：库存调整（StockAdjustPanel 自带成功 Toast） */}
        <MerchantBentoBlock title="库存调整">
          <StockAdjustPanel currentStock={stock} onSubmit={handleStock} />
        </MerchantBentoBlock>
      </ScrollView>
    </View>
  );
}
