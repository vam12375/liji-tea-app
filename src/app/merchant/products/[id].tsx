import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { StockAdjustPanel } from "@/components/merchant/StockAdjustPanel";
import { AppHeader } from "@/components/ui/AppHeader";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { useMerchantStore } from "@/stores/merchantStore";

// 商品详情/编辑页：
// - 基本信息：name / price / description / is_active，保存走
//   merchant_update_product 白名单 patch。
// - 独立库存调整面板：merchant_update_stock（delta 非零 + 必填原因）。
// MVP 不做新建商品与图片上传（V2）。
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

  // 商品切换时初始化表单；同一商品多次渲染不重置，避免吞掉用户正在输入的内容。
  useEffect(() => {
    if (!product) return;
    setName(product.name ?? "");
    setPrice(String(product.price ?? ""));
    setDescription(product.description ?? "");
    setIsActive(product.is_active !== false);
  }, [product?.id]);

  if (!product) {
    return (
      <View className="flex-1 bg-surface">
        <AppHeader title="商品编辑" showBackButton />
        <View className="flex-1 items-center justify-center">
          <Text className="text-on-surface-variant">商品不存在或未加载</Text>
        </View>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim() || Number.isNaN(Number(price))) {
      Alert.alert("请填写合法的名称与价格");
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
      Alert.alert("保存成功");
    } catch (err) {
      Alert.alert("保存失败", classifyMerchantError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleStock = async (delta: number, reason: string) => {
    try {
      await updateStock(product.id, delta, reason);
    } catch (err) {
      Alert.alert("调整失败", classifyMerchantError(err).message);
      throw err;
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="商品编辑" showBackButton />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View className="gap-2 p-4 rounded-2xl bg-surface-bright">
          <Text className="text-on-surface font-semibold">基本信息</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="商品名"
            className="border border-outline-variant rounded-lg px-3 py-2 text-on-surface"
          />
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="价格"
            className="border border-outline-variant rounded-lg px-3 py-2 text-on-surface"
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="描述"
            multiline
            className="border border-outline-variant rounded-lg px-3 py-2 text-on-surface min-h-[80px]"
          />
          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-on-surface">上架状态</Text>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>
          <Pressable
            disabled={saving}
            onPress={handleSave}
            className={`rounded-lg py-2.5 items-center mt-1 ${
              saving ? "bg-surface-variant" : "bg-primary"
            }`}
          >
            <Text
              className={saving ? "text-on-surface-variant" : "text-on-primary"}
            >
              {saving ? "保存中…" : "保存基本信息"}
            </Text>
          </Pressable>
        </View>

        <StockAdjustPanel currentStock={product.stock ?? 0} onSubmit={handleStock} />
      </ScrollView>
    </View>
  );
}
