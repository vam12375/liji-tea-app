import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { defaultSearchHistory, hotSearches, suggestedProducts } from "@/data/search";
import SearchHistoryChips from "@/components/search/SearchHistoryChips";
import HotSearches from "@/components/search/HotSearches";

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState(defaultSearchHistory);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 搜索栏 */}
      <View className="px-4 pt-2 pb-3 flex-row items-center gap-3">
        <View className="flex-1 flex-row items-center bg-surface-container-high rounded-full px-4 h-11 gap-2">
          <MaterialIcons name="search" size={20} color={Colors.outline} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索茶品、茶器、冲泡方法..."
            placeholderTextColor={Colors.outline}
            className="flex-1 text-on-surface text-sm"
            autoFocus
            returnKeyType="search"
          />
          <Pressable hitSlop={8}>
            <MaterialIcons name="photo-camera" size={20} color={Colors.outline} />
          </Pressable>
        </View>
        <Pressable onPress={() => router.back()}>
          <Text className="text-primary text-sm">取消</Text>
        </Pressable>
      </View>

      {/* 内容 */}
      <FlatList
        data={suggestedProducts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperClassName="gap-3 px-4"
        contentContainerClassName="px-4 gap-8 pb-8"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-8">
            <SearchHistoryChips items={history} onClear={() => setHistory([])} onSelect={setQuery} />
            <HotSearches items={hotSearches} onSelect={setQuery} />
            <Text className="text-on-surface font-medium text-sm">猜你喜欢</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable className="flex-1 active:opacity-80">
            <View className="aspect-[4/5] rounded-xl overflow-hidden mb-2">
              <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
            </View>
            <Text className="font-headline text-on-surface text-sm font-bold" numberOfLines={1}>{item.name}</Text>
            <Text className="text-on-surface-variant text-xs">{item.desc}</Text>
            <Text className="text-tertiary font-bold mt-1">{item.price}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
