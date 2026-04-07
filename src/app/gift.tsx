import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, Switch, Dimensions } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { messageTags } from "@/data/gifts";
import { useGiftStore } from "@/stores/giftStore";
import { showModal } from "@/stores/modalStore";

const CARD_WIDTH = Dimensions.get("window").width - 64;

export default function GiftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { giftCards, giftSets, fetchGiftCards, fetchGiftSets } = useGiftStore();
  const [selectedCard, setSelectedCard] = useState("");
  const [selectedSet, setSelectedSet] = useState("");
  const [message, setMessage] = useState("");
  const [wechat, setWechat] = useState(false);
  // 收礼人信息
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  useEffect(() => {
    void fetchGiftCards();
    void fetchGiftSets();
  }, [fetchGiftCards, fetchGiftSets]);

  // 选中第一个（数据加载后）
  useEffect(() => {
    if (giftCards.length > 0 && !selectedCard) setSelectedCard(giftCards[0].id);
  }, [giftCards, selectedCard]);
  useEffect(() => {
    if (giftSets.length > 1 && !selectedSet) setSelectedSet(giftSets[1].id);
  }, [giftSets, selectedSet]);

  const selectedPrice = giftSets.find((s) => s.id === selectedSet)?.price ?? 0;

  // 赠送茶礼提交处理
  const handleSubmit = () => {
    if (!selectedCard) { showModal('提示', '请选择一张贺卡'); return; }
    if (!selectedSet) { showModal('提示', '请选择一套茶礼'); return; }
    if (!recipientName.trim()) { showModal('提示', '请输入收礼人姓名'); return; }
    if (!recipientPhone.trim() || recipientPhone.length !== 11) { showModal('提示', '请输入正确的11位手机号'); return; }

    // 实际下单逻辑 — 目前先显示成功提示
    showModal('茶礼已送出', `已向 ${recipientName.trim()} 发送茶礼，对方将收到通知。`, 'success');
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "以茶为礼",
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

      <FlatList
        data={[1]}
        renderItem={() => (
          <View className="gap-8 px-4 pb-32">
            {/* 礼品卡选择 - 横向滚动 */}
            <View className="gap-3">
              <Text className="font-headline text-on-surface text-base font-bold">选择贺卡</Text>
              <FlatList
                data={giftCards}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 12}
                decelerationRate="fast"
                contentContainerStyle={{ gap: 12 }}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setSelectedCard(item.id)}
                    className={`rounded-2xl overflow-hidden ${selectedCard === item.id ? "ring-2 ring-primary/20" : ""}`}
                    style={{ width: CARD_WIDTH }}
                  >
                    <View className="aspect-video relative">
                      <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                      <View className="absolute inset-0 bg-black/40" />
                      <View className="absolute bottom-4 left-5 gap-0.5">
                        <Text className="font-headline text-surface-bright text-xl font-bold">{item.title}</Text>
                        <Text className="text-surface-bright/70 text-xs">{item.subtitle}</Text>
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            </View>

            {/* 祝福语 */}
            <View className="gap-3">
              <Text className="font-headline text-on-surface text-base font-bold">祝福语</Text>
              <TextInput
                value={message}
                onChangeText={(t) => setMessage(t.slice(0, 100))}
                placeholder="写下你的祝福..."
                placeholderTextColor={Colors.outline}
                className="bg-surface-container-low rounded-xl p-4 text-on-surface text-sm min-h-[100px]"
                multiline
                textAlignVertical="top"
              />
              <View className="flex-row justify-between items-center">
                <View className="flex-row gap-2">
                  {messageTags.map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() => setMessage(tag)}
                      className="bg-surface-container-high px-3 py-1 rounded-full"
                    >
                      <Text className="text-on-surface-variant text-xs">{tag}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-outline text-xs">{message.length}/100</Text>
              </View>
            </View>

            {/* 茶礼套装 */}
            <View className="gap-3">
              <Text className="font-headline text-on-surface text-base font-bold">选择茶礼</Text>
              {giftSets.map((set) => (
                <Pressable
                  key={set.id}
                  onPress={() => setSelectedSet(set.id)}
                  className={`flex-row items-center gap-3 p-3 rounded-xl ${
                    selectedSet === set.id ? "bg-primary-container/10 border border-primary/10" : "bg-surface-container-low"
                  }`}
                >
                  <Image source={{ uri: set.image }} style={{ width: 96, height: 96, borderRadius: 8 }} contentFit="cover" />
                  <View className="flex-1 gap-1">
                    <Text className="font-headline text-on-surface text-sm font-bold">{set.name}</Text>
                    <Text className="text-on-surface-variant text-xs">{set.description}</Text>
                    <Text className="text-tertiary font-bold mt-1">¥{set.price}</Text>
                  </View>
                  <MaterialIcons
                    name={selectedSet === set.id ? "check-circle" : "radio-button-unchecked"}
                    size={22}
                    color={selectedSet === set.id ? Colors.primaryContainer : Colors.outlineVariant}
                  />
                </Pressable>
              ))}
            </View>

            {/* 收礼人信息 */}
            <View className="gap-3">
              <Text className="font-headline text-on-surface text-base font-bold">收礼人</Text>
              <TextInput
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="姓名"
                placeholderTextColor={Colors.outline}
                className="bg-surface-container-low rounded-xl px-4 py-3 text-on-surface text-sm"
              />
              <TextInput
                value={recipientPhone}
                onChangeText={(t) => setRecipientPhone(t.replace(/\D/g, '').slice(0, 11))}
                placeholder="手机号"
                placeholderTextColor={Colors.outline}
                keyboardType="phone-pad"
                className="bg-surface-container-low rounded-xl px-4 py-3 text-on-surface text-sm"
              />
              <View className="flex-row items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="chat" size={18} color={Colors.primaryContainer} />
                  <Text className="text-on-surface text-sm">通过微信发送</Text>
                </View>
                <Switch
                  value={wechat}
                  onValueChange={setWechat}
                  trackColor={{ true: Colors.primaryContainer, false: Colors.outlineVariant }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        )}
        keyExtractor={() => "gift-content"}
        showsVerticalScrollIndicator={false}
      />

      {/* 底部操作栏 */}
      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3"
      >
        <Pressable onPress={handleSubmit} className="bg-primary-container rounded-full py-4 flex-row items-center justify-center gap-3 active:bg-primary">
          <Text className="text-on-primary font-headline text-lg font-bold">¥{selectedPrice}</Text>
          <Text className="text-on-primary font-medium">赠送茶礼</Text>
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
