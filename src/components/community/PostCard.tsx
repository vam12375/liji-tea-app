import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { shareContent } from '@/lib/share';
import { useCommunityStore } from '@/stores/communityStore';
import { useUserStore } from '@/stores/userStore';
import { showModal } from '@/stores/modalStore';
import type { Post } from '@/data/community';


export default function PostCard({ post }: { post: Post }) {
  const togglePostLike = useCommunityStore((s) => s.togglePostLike);
  const togglePostBookmark = useCommunityStore((s) => s.togglePostBookmark);
  const session = useUserStore((s) => s.session);

  const onPress = () =>
    router.push({ pathname: "/post/[id]", params: { id: post.id } });

  const handleShare = async () => {
    const text = post.caption ?? post.title ?? post.quote ?? post.description;

    try {
      await shareContent({
        path: `/post/${encodeURIComponent(post.id)}`,
        title: post.title ?? `${post.author} 的分享`,
        lines: [`【李记茶铺社区】${post.author}`, text],
      });
    } catch {
      // 用户取消分享
    }
  };

  /** 点赞处理 */
  const handleLike = async (e: any) => {
    e.stopPropagation();
    if (!session?.user?.id) {
      showModal('请先登录', '登录后才可以点赞。', 'info');
      return;
    }
    try { await togglePostLike(post.id); } catch {}
  };

  /** 收藏处理 */
  const handleBookmark = async (e: any) => {
    e.stopPropagation();
    if (!session?.user?.id) {
      showModal('请先登录', '登录后才可以收藏。', 'info');
      return;
    }
    try { await togglePostBookmark(post.id); } catch {}
  };

  if (post.type === 'photo') {
    return <PhotoPost post={post} onPress={onPress} onShare={handleShare} onLike={handleLike} onBookmark={handleBookmark} />;
  }

  if (post.type === 'brewing') {
    return <BrewingPost post={post} onPress={onPress} onShare={handleShare} onLike={handleLike} onBookmark={handleBookmark} />;
  }

  return <QuestionPost post={post} onPress={onPress} onShare={handleShare} />;
}


function PostHeader({ post }: { post: Post }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2.5">
        <Image source={{ uri: post.avatar }} style={{ width: 40, height: 40, borderRadius: 9999 }} contentFit="cover" />
        <View>
          <Text className="text-on-surface text-sm font-bold">{post.author}</Text>
          <Text className="text-secondary/60 text-[11px]">
            {post.time}{post.location ? ` · ${post.location}` : ''}
          </Text>
        </View>
      </View>
      <Pressable hitSlop={8}>
        <MaterialIcons name="more-horiz" size={20} color={Colors.outline} />
      </Pressable>
    </View>
  );
}

function PhotoPost({
  post,
  onPress,
  onShare,
  onLike,
  onBookmark,
}: {
  post: Post;
  onPress: () => void;
  onShare: () => void;
  onLike: (e: any) => void;
  onBookmark: (e: any) => void;
}) {
  return (
    <Pressable className="gap-3 active:opacity-90" onPress={onPress}>

      <PostHeader post={post} />
      {post.image ? (
        <Image source={{ uri: post.image }} style={{ width: '100%', height: 288, borderRadius: 12 }} contentFit="cover" />
      ) : null}
      <Text className="text-on-surface text-[15px] leading-relaxed">{post.caption}</Text>
      <View className="flex-row justify-between items-center">
        <View className="flex-row gap-5">
          {/* 点赞按钮 */}
          <Pressable hitSlop={8} onPress={onLike} className="flex-row items-center gap-1">
            <MaterialIcons name={post.isLiked ? 'favorite' : 'favorite-border'} size={20} color={post.isLiked ? Colors.error : Colors.secondary} />
            <Text className="text-secondary text-sm">{post.likes}</Text>
          </Pressable>
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.secondary} />
            <Text className="text-secondary text-sm">{post.comments}</Text>
          </View>
        </View>
        <View className="flex-row gap-4">
          {/* 收藏按钮 */}
          <Pressable hitSlop={8} onPress={onBookmark}>
            <MaterialIcons name={post.isBookmarked ? 'bookmark' : 'bookmark-border'} size={20} color={post.isBookmarked ? Colors.primary : Colors.secondary} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              void onShare();
            }}
          >
            <MaterialIcons name="share" size={20} color={Colors.secondary} />
          </Pressable>
        </View>

      </View>
    </Pressable>
  );
}

function BrewingPost({
  post,
  onPress,
  onShare,
  onLike,
  onBookmark,
}: {
  post: Post;
  onPress: () => void;
  onShare: () => void;
  onLike: (e: any) => void;
  onBookmark: (e: any) => void;
}) {
  return (
    <Pressable onPress={onPress} className="bg-surface-container-low rounded-2xl border-l-4 border-primary-container p-5 gap-3 active:opacity-90">

      <View className="flex-row items-center gap-2">
        <View className="bg-primary-container/20 px-2 py-0.5 rounded">
          <Text className="text-primary text-[10px] font-bold">冲泡分享</Text>
        </View>
        <Text className="text-on-surface text-sm font-bold">{post.author}</Text>
      </View>
      {post.brewingImages?.length ? (
        <View className="flex-row gap-2">
          {post.brewingImages.map((image, index) => (
            <Image key={`${image}-${index}`} source={{ uri: image }} style={{ flex: 1, height: 128, borderRadius: 8 }} contentFit="cover" />
          ))}
        </View>
      ) : null}
      <View className="bg-surface p-3 rounded-lg gap-2">
        <View className="bg-secondary-container/30 self-start px-2 py-0.5 rounded">
          <Text className="text-secondary text-[10px]">{post.teaName}</Text>
        </View>
        {post.brewingData ? (
          <View className="flex-row gap-4">
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="thermostat" size={14} color={Colors.outline} />
              <Text className="text-on-surface text-xs">{post.brewingData.temp}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="schedule" size={14} color={Colors.outline} />
              <Text className="text-on-surface text-xs">{post.brewingData.time}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="scale" size={14} color={Colors.outline} />
              <Text className="text-on-surface text-xs">{post.brewingData.amount}</Text>
            </View>
          </View>
        ) : null}
        {post.quote ? (
          <Text className="text-secondary italic text-sm">
            {"\u201C"}
            {post.quote}
            {"\u201D"}
          </Text>
        ) : null}
      </View>
      <View className="flex-row justify-between items-center">
        <View className="flex-row gap-5">
          {/* 点赞按钮 */}
          <Pressable hitSlop={8} onPress={onLike} className="flex-row items-center gap-1">
            <MaterialIcons name={post.isLiked ? 'favorite' : 'favorite-border'} size={20} color={post.isLiked ? Colors.error : Colors.secondary} />
            <Text className="text-secondary text-sm">{post.likes}</Text>
          </Pressable>
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.secondary} />
            <Text className="text-secondary text-sm">{post.comments}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-4">
          {/* 收藏按钮 */}
          <Pressable hitSlop={8} onPress={onBookmark}>
            <MaterialIcons name={post.isBookmarked ? 'bookmark' : 'bookmark-border'} size={20} color={post.isBookmarked ? Colors.primary : Colors.secondary} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              void onShare();
            }}
          >
            <MaterialIcons name="share" size={20} color={Colors.secondary} />
          </Pressable>
        </View>
      </View>

    </Pressable>
  );
}

function QuestionPost({
  post,
  onPress,
  onShare,
}: {
  post: Post;
  onPress: () => void;
  onShare: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="bg-surface-container-highest/40 p-6 rounded-3xl gap-3 active:opacity-90">

      <View className="bg-tertiary-fixed self-start px-2.5 py-0.5 rounded-full">
        <Text className="text-on-surface text-[10px] font-bold">求助</Text>
      </View>
      <Text className="font-headline text-on-surface text-lg font-bold">{post.title}</Text>
      <Text className="text-on-surface/80 text-sm leading-relaxed">{post.description}</Text>
      <View className="flex-row justify-between items-center pt-2 gap-3">
        <Text className="text-outline text-xs flex-1">{post.answerCount ?? post.comments} 人已回答</Text>
        <View className="flex-row items-center gap-3">
          <Pressable
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              void onShare();
            }}
          >
            <MaterialIcons name="share" size={20} color={Colors.secondary} />
          </Pressable>
          <View className="bg-primary px-5 py-2 rounded-full">
            <Text className="text-on-primary text-sm font-medium">我来回答</Text>
          </View>
        </View>
      </View>

    </Pressable>
  );
}
