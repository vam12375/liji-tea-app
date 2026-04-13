import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { useCommunityStore } from '@/stores/communityStore';

export default function StoryRow() {
  // 故事列表由社区页统一拉取，这个展示行只负责渲染和已读标记，避免子组件重复请求。
  const stories = useCommunityStore((state) => state.stories);
  const markStoryViewed = useCommunityStore((state) => state.markStoryViewed);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4 px-1">
      <Pressable className="items-center gap-1" onPress={() => router.push('/community/create')}>
        <View className="w-14 h-14 rounded-full border-2 border-dashed border-outline-variant bg-surface-container items-center justify-center">
          <MaterialIcons name="add" size={22} color={Colors.primary} />
        </View>
        <Text className="text-on-surface text-[10px] font-medium">发布</Text>
      </Pressable>

      {stories.map((story) => (
        <Pressable key={story.id} className="items-center gap-1" onPress={() => {
          void markStoryViewed(story.id);
          router.push({ pathname: '/story-viewer', params: { storyId: story.id } });
        }}>
          <View className={`p-[2px] rounded-full border-2 ${story.isViewed ? 'border-outline-variant/30' : 'border-tertiary-fixed'}`}>
            <Image source={{ uri: story.avatar }} style={{ width: 48, height: 48, borderRadius: 9999 }} contentFit="cover" />
          </View>
          <Text className="text-on-surface text-[10px] font-medium" numberOfLines={1}>{story.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
