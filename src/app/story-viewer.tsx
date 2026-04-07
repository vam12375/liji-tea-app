import { useEffect, useState } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCommunityStore } from '@/stores/communityStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function StoryViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { storyId } = useLocalSearchParams<{ storyId: string }>();
  const stories = useCommunityStore((s) => s.stories);
  const markStoryViewed = useCommunityStore((s) => s.markStoryViewed);

  const currentIndex = stories.findIndex((s) => s.id === storyId);
  const [index, setIndex] = useState(Math.max(0, currentIndex));
  const story = stories[index];

  // 标记当前故事为已查看
  useEffect(() => {
    if (story) void markStoryViewed(story.id);
  }, [story, markStoryViewed]);

  // 自动播放：5秒后下一条
  useEffect(() => {
    const timer = setTimeout(() => {
      if (index < stories.length - 1) {
        setIndex(index + 1);
      } else {
        router.back();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [index, stories.length, router]);

  if (!story) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">故事不存在</Text>
      </View>
    );
  }

  // 点击左半屏上一条，右半屏下一条
  const handleTap = (x: number) => {
    if (x < SCREEN_WIDTH / 3) {
      // 上一条
      if (index > 0) setIndex(index - 1);
    } else {
      // 下一条
      if (index < stories.length - 1) setIndex(index + 1);
      else router.back();
    }
  };

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />

      <Pressable
        className="flex-1"
        onPress={(e) => handleTap(e.nativeEvent.locationX)}
      >
        {story.image ? (
          <Image
            source={{ uri: story.image }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
            contentFit="cover"
          />
        ) : (
          <View className="flex-1 bg-surface-container items-center justify-center">
            <Text className="text-on-surface text-lg">{story.caption ?? '无内容'}</Text>
          </View>
        )}
      </Pressable>

      {/* 进度条 */}
      <View style={{ paddingTop: insets.top + 8 }} className="absolute top-0 left-0 right-0 px-3 gap-3">
        <View className="flex-row gap-1">
          {stories.map((s, i) => (
            <View key={s.id} className="flex-1 h-0.5 rounded-full" style={{ backgroundColor: i <= index ? '#fff' : 'rgba(255,255,255,0.3)' }} />
          ))}
        </View>

        {/* 用户信息和关闭按钮 */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Image source={{ uri: story.avatar }} style={{ width: 32, height: 32, borderRadius: 9999 }} />
            <Text className="text-white text-sm font-bold">{story.name}</Text>
          </View>
          <Pressable hitSlop={8} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* 底部文字 */}
      {story.caption ? (
        <View style={{ paddingBottom: insets.bottom + 16 }} className="absolute bottom-0 left-0 right-0 px-4">
          <Text className="text-white text-sm">{story.caption}</Text>
        </View>
      ) : null}
    </View>
  );
}
