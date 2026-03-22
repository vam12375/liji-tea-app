import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useUserStore, type Address } from "@/stores/userStore";

export default function AddressesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addresses, fetchAddresses, addAddress, removeAddress, setDefaultAddress } =
    useUserStore();

  // 新增地址表单状态
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");

  // 页面加载时拉取地址数据
  useEffect(() => {
    fetchAddresses();
  }, []);

  /** 重置并隐藏表单 */
  const resetForm = () => {
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setShowForm(false);
  };

  /** 保存新地址 */
  const handleSave = async () => {
    // 简单校验
    if (!formName.trim()) {
      Alert.alert("提示", "请输入姓名");
      return;
    }
    if (!formPhone.trim()) {
      Alert.alert("提示", "请输入电话");
      return;
    }
    if (!formAddress.trim()) {
      Alert.alert("提示", "请输入详细地址");
      return;
    }

    const err = await addAddress({
      name: formName.trim(),
      phone: formPhone.trim(),
      address: formAddress.trim(),
      is_default: addresses.length === 0,
    });

    if (err) {
      Alert.alert("保存失败", err);
    } else {
      resetForm();
    }
  };

  /** 确认删除地址 */
  const handleRemove = (id: string) => {
    Alert.alert("确认删除", "确定要删除该地址吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => removeAddress(id),
      },
    ]);
  };

  /** 渲染单个地址卡片 */
  const renderAddressCard = ({ item }: { item: Address }) => (
    <View className="bg-surface-container-low rounded-xl px-4 py-3 mb-3">
      {/* 第一行：姓名 + 电话 */}
      <View className="flex-row items-center mb-1">
        <Text className="text-on-surface text-sm font-medium">{item.name}</Text>
        <Text className="text-outline text-sm ml-3">{item.phone}</Text>
        {item.is_default && (
          <View className="bg-primary/15 px-2 py-0.5 rounded ml-2">
            <Text className="text-primary text-[10px] font-medium">默认</Text>
          </View>
        )}
      </View>

      {/* 第二行：地址文本 */}
      <Text className="text-outline text-xs leading-4 mb-2">{item.address}</Text>

      {/* 操作按钮 */}
      <View className="flex-row items-center border-t border-outline-variant/10 pt-2 gap-4">
        {!item.is_default && (
          <Pressable
            onPress={() => setDefaultAddress(item.id)}
            className="active:opacity-70"
          >
            <Text className="text-primary text-xs">设为默认</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => handleRemove(item.id)}
          className="active:opacity-70"
        >
          <Text className="text-error text-xs">删除</Text>
        </Pressable>
      </View>
    </View>
  );

  /** 新增地址内联表单 */
  const renderForm = () => {
    if (!showForm) return null;

    return (
      <View className="bg-surface-container-low rounded-xl px-4 py-4 mb-4">
        <Text className="text-on-surface text-sm font-medium mb-3">新增地址</Text>

        <TextInput
          value={formName}
          onChangeText={setFormName}
          placeholder="姓名"
          placeholderTextColor={Colors.outline}
          className="border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface mb-2"
        />
        <TextInput
          value={formPhone}
          onChangeText={setFormPhone}
          placeholder="电话"
          placeholderTextColor={Colors.outline}
          keyboardType="phone-pad"
          className="border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface mb-2"
        />
        <TextInput
          value={formAddress}
          onChangeText={setFormAddress}
          placeholder="详细地址"
          placeholderTextColor={Colors.outline}
          multiline
          className="border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface mb-3"
        />

        <View className="flex-row gap-3">
          <Pressable
            onPress={resetForm}
            className="flex-1 py-2.5 rounded-lg border border-outline-variant/30 items-center active:opacity-70"
          >
            <Text className="text-outline text-sm">取消</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            className="flex-1 py-2.5 rounded-lg bg-primary-container items-center active:opacity-70"
          >
            <Text className="text-on-primary text-sm font-medium">保存</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  /** 空状态提示 */
  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center py-20">
      <MaterialIcons name="location-off" size={56} color={Colors.outlineVariant} />
      <Text className="text-outline text-sm mt-3">暂无收货地址</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "收货地址",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          renderItem={renderAddressCard}
          ListHeaderComponent={renderForm}
          ListEmptyComponent={showForm ? null : renderEmpty}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: (insets.bottom || 16) + 72,
          }}
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>

      {/* 底部固定按钮 — 新增地址 */}
      {!showForm && (
        <View
          style={{ paddingBottom: insets.bottom || 16 }}
          className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3"
        >
          <Pressable
            onPress={() => setShowForm(true)}
            className="bg-primary-container py-3 rounded-full items-center active:bg-primary"
          >
            <Text className="text-on-primary font-medium">新增地址</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
