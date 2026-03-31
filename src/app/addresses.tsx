import { Colors } from "@/constants/Colors";
import { showConfirm, showModal } from "@/stores/modalStore";
import { useUserStore, type Address } from "@/stores/userStore";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AddressFormValues = {
  name: string;
  phone: string;
  address: string;
};

type AddressFormProps = {
  onSave: (values: AddressFormValues) => Promise<void>;
  onCancel: () => void;
};

const AddressForm = memo(function AddressForm({
  onSave,
  onCancel,
}: AddressFormProps) {
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const handlePhoneChange = (text: string) => {
    setFormPhone(text.replace(/\D/g, "").slice(0, 11));
  };

  const handleSave = async () => {
    const name = formName.trim();
    const phone = formPhone.trim();
    const address = formAddress.trim();

    if (!name) {
      showModal("提示", "请输入收件人姓名");
      return;
    }
    if (!phone || phone.length !== 11) {
      showModal("提示", "请输入正确的11位手机号码");
      return;
    }
    if (!address) {
      showModal("提示", "请输入详细收货地址");
      return;
    }

    await onSave({ name, phone, address });
    setFormName("");
    setFormPhone("");
    setFormAddress("");
  };

  const handleCancel = () => {
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    onCancel();
  };

  return (
    <View className="bg-surface-container-low rounded-xl px-4 py-4 mb-4">
      <Text className="text-on-surface text-sm font-medium mb-3">新增地址</Text>

      <TextInput
        value={formName}
        onChangeText={setFormName}
        placeholder="请输入收件人姓名"
        placeholderTextColor={Colors.outline}
        className="border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface mb-2"
      />
      <TextInput
        value={formPhone}
        onChangeText={handlePhoneChange}
        placeholder="请输入11位手机号码"
        placeholderTextColor={Colors.outline}
        keyboardType="number-pad"
        maxLength={11}
        className="border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface mb-2"
      />
      <TextInput
        value={formAddress}
        onChangeText={setFormAddress}
        placeholder="请输入详细收货地址"
        placeholderTextColor={Colors.outline}
        multiline
        className="border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface mb-3"
      />

      <View className="flex-row gap-3">
        <Pressable
          onPress={handleCancel}
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
});

export default function AddressesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    addresses,
    fetchAddresses,
    addAddress,
    removeAddress,
    setDefaultAddress,
  } = useUserStore();

  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
  }, []);

  const handleSaveAddress = useCallback(async ({
    name,
    phone,
    address,
  }: AddressFormValues) => {
    const err = await addAddress({
      name,
      phone,
      address,
      is_default: addresses.length === 0,
    });

    if (err) {
      showModal("保存失败", err, "error");
      return;
    }

    setShowForm(false);
  }, [addAddress, addresses.length]);

  /** 确认删除地址 */
  const handleRemove = (id: string) => {
    showConfirm("确认删除", "确定要删除该地址吗？", () => removeAddress(id), {
      icon: "delete",
      confirmText: "删除",
      confirmStyle: "destructive",
    });
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
      <Text className="text-outline text-xs leading-4 mb-2">
        {item.address}
      </Text>

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

  const listHeaderComponent = useMemo(() => {
    if (!showForm) {
      return null;
    }

    return (
      <AddressForm onSave={handleSaveAddress} onCancel={handleCancelForm} />
    );
  }, [handleCancelForm, handleSaveAddress, showForm]);

  /** 空状态提示 */
  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center py-20">
      <MaterialIcons
        name="location-off"
        size={56}
        color={Colors.outlineVariant}
      />
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
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={Colors.onSurface}
              />
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
          ListHeaderComponent={listHeaderComponent}
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
