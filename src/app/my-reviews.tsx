import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';

export default function MyReviewsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '我的评价',
          headerTitleStyle: { fontFamily: 'Manrope_500Medium', fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <View className="flex-1 items-center justify-center px-8 gap-4">
        <MaterialIcons name="rate-review" size={64} color={Colors.outlineVariant} />
        <Text className="text-on-surface text-base font-medium">我的评价</Text>
        <Text className="text-outline text-sm text-center leading-6">
          购买商品后可以对商品进行评价，帮助其他茶友做出更好的选择。
        </Text>
      </View>
    </View>
  );
}
