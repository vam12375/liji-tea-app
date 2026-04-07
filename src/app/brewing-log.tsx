import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';

export default function BrewingLogScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '冲泡记录',
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
        <MaterialIcons name="history-edu" size={64} color={Colors.outlineVariant} />
        <Text className="text-on-surface text-base font-medium">冲泡记录</Text>
        <Text className="text-outline text-sm text-center leading-6">
          在社区分享冲泡心得后，您的冲泡记录会出现在这里，方便随时回顾和改进冲泡技巧。
        </Text>
        <Pressable
          onPress={() => router.push('/community/create')}
          className="mt-2 bg-primary-container rounded-full px-6 py-2.5 active:bg-primary"
        >
          <Text className="text-on-primary font-medium">去分享冲泡</Text>
        </Pressable>
      </View>
    </View>
  );
}
