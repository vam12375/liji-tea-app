import { View, Text, FlatList, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';

// 本地通知数据模型（后续可接入服务端）
interface Notification {
  id: string;
  type: 'order' | 'system' | 'community';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'system', title: '欢迎来到李记茶', message: '感谢您注册成为李记茶会员，开始您的品茶之旅吧。', time: '刚刚', read: false },
  { id: '2', type: 'order', title: '订单提醒', message: '您有一笔待付款订单即将超时，请尽快完成支付。', time: '5分钟前', read: false },
  { id: '3', type: 'community', title: '社区互动', message: '有人回复了您的帖子，快去看看吧。', time: '1小时前', read: true },
];

const ICON_MAP: Record<Notification['type'], { icon: string; color: string }> = {
  order: { icon: 'receipt-long', color: '#f97316' },
  system: { icon: 'campaign', color: Colors.primary },
  community: { icon: 'forum', color: Colors.tertiary },
};

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '消息通知',
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

      <FlatList
        data={MOCK_NOTIFICATIONS}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 py-4 gap-3"
        renderItem={({ item }) => {
          const iconConfig = ICON_MAP[item.type];
          return (
            <View className={`bg-surface-container-low rounded-xl p-4 gap-2 ${!item.read ? 'border-l-4 border-primary' : ''}`}>
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: `${iconConfig.color}20` }}>
                  <MaterialIcons name={iconConfig.icon as any} size={18} color={iconConfig.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-on-surface text-sm font-medium">{item.title}</Text>
                  <Text className="text-outline text-[10px]">{item.time}</Text>
                </View>
                {!item.read && <View className="w-2 h-2 rounded-full bg-primary" />}
              </View>
              <Text className="text-on-surface-variant text-xs leading-5 pl-12">{item.message}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <MaterialIcons name="notifications-none" size={56} color={Colors.outlineVariant} />
            <Text className="text-outline text-sm mt-3">暂无消息</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
