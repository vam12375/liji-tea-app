import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';

import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { shareContent } from '@/lib/share';
import { useCommunityStore, type Post, type Comment } from '@/stores/communityStore';
import { useUserStore } from '@/stores/userStore';
import { showModal } from '@/stores/modalStore';


export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const posts = useCommunityStore((state) => state.posts);
  const activePost = useCommunityStore((state) => state.activePost);
  const likedPostIds = useCommunityStore((state) => state.likedPostIds);
  const likedCommentIds = useCommunityStore((state) => state.likedCommentIds);
  const bookmarkedPostIds = useCommunityStore((state) => state.bookmarkedPostIds);
  const detailLoading = useCommunityStore((state) => state.detailLoading);
  const fetchPostDetail = useCommunityStore((state) => state.fetchPostDetail);
  const togglePostLike = useCommunityStore((state) => state.togglePostLike);
  const togglePostBookmark = useCommunityStore((state) => state.togglePostBookmark);
  const addComment = useCommunityStore((state) => state.addComment);
  const toggleCommentLike = useCommunityStore((state) => state.toggleCommentLike);
  const session = useUserStore((state) => state.session);
  const post = activePost?.id === id ? activePost : posts.find((item) => item.id === id);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void fetchPostDetail(id);
  }, [fetchPostDetail, id]);

  const requireLogin = () => {
    if (session?.user?.id) return true;
    showModal('请先登录', '登录后才可以点赞、收藏或评论。', 'info');
    router.push('/login');
    return false;
  };

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || !post) return;
    if (!requireLogin()) return;

    try {
      setCommentSubmitting(true);
      await addComment(post.id, text);
      setCommentText('');
      Keyboard.dismiss();
    } catch (error: any) {
      showModal('评论失败', error?.message ?? '请稍后重试。', 'error');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleTogglePostLike = async () => {
    if (!post || !requireLogin()) return;

    try {
      await togglePostLike(post.id);
    } catch (error: any) {
      showModal('操作失败', error?.message ?? '请稍后重试。', 'error');
    }
  };

  const handleToggleBookmark = async () => {
    if (!post || !requireLogin()) return;

    try {
      await togglePostBookmark(post.id);
    } catch (error: any) {
      showModal('收藏失败', error?.message ?? '请稍后重试。', 'error');
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!post || !requireLogin()) return;

    try {
      await toggleCommentLike(post.id, commentId);
    } catch (error: any) {
      showModal('操作失败', error?.message ?? '请稍后重试。', 'error');
    }
  };

  const handleShare = async () => {
    if (!post) return;

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



  const handleMenu = () => {
    showModal('操作', '帖子管理功能会在下一版补齐。', 'info');
  };

  if (!post && detailLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3">
        <MaterialIcons name="hourglass-top" size={26} color={Colors.outline} />
        <Text className="text-on-surface-variant text-base">正在加载帖子...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-on-surface-variant text-base">帖子未找到</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-2 bg-primary rounded-full">
          <Text className="text-on-primary text-sm">返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }} className="px-4 pb-3 bg-background border-b border-outline-variant/10">
        <View className="flex-row items-center h-12">
          <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center active:opacity-60">
            <MaterialIcons name="arrow-back" size={22} color={Colors.onSurface} />
          </Pressable>
          <View className="flex-1 flex-row items-center gap-2.5 ml-2">
            <Image source={{ uri: post.avatar }} style={{ width: 32, height: 32, borderRadius: 9999 }} contentFit="cover" />
            <View>
              <Text className="text-on-surface text-sm font-bold">{post.author}</Text>
              <Text className="text-outline text-[10px]">{post.time}</Text>
            </View>
          </View>
          <Pressable hitSlop={8} onPress={handleMenu}>
            <MaterialIcons name="more-horiz" size={22} color={Colors.outline} />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-5 pb-4">
          <PostContent post={post} />
        </View>

        <View className="px-5 pb-4 flex-row justify-between items-center border-b border-outline-variant/10">
          <View className="flex-row gap-5">
            <Pressable onPress={handleTogglePostLike} className="flex-row items-center gap-1.5">
              <MaterialIcons
                name={likedPostIds.has(post.id) ? 'favorite' : 'favorite-border'}
                size={22}
                color={likedPostIds.has(post.id) ? Colors.error : Colors.secondary}
              />
              <Text className="text-secondary text-sm">{post.likes}</Text>
            </Pressable>
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons name="chat-bubble-outline" size={22} color={Colors.secondary} />
              <Text className="text-secondary text-sm">{post.commentList?.length ?? post.comments}</Text>
            </View>
          </View>
          <View className="flex-row gap-4">
            <Pressable hitSlop={8} onPress={handleToggleBookmark}>
              <MaterialIcons
                name={bookmarkedPostIds.has(post.id) ? 'bookmark' : 'bookmark-border'}
                size={22}
                color={bookmarkedPostIds.has(post.id) ? Colors.primary : Colors.secondary}
              />
            </Pressable>
            <Pressable hitSlop={8} onPress={handleShare}>
              <MaterialIcons name="share" size={22} color={Colors.secondary} />
            </Pressable>
          </View>
        </View>

        <View className="px-5 pt-4 pb-2">
          <Text className="text-on-surface font-bold text-base mb-4">
            评论 ({post.commentList?.length ?? 0})
          </Text>
          {post.commentList?.length ? (
            post.commentList.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                isLiked={likedCommentIds.has(comment.id)}
                onToggleLike={() => handleToggleCommentLike(comment.id)}
              />
            ))
          ) : (
            <View className="rounded-2xl bg-surface-container-low px-4 py-5 items-center gap-2">
              <MaterialIcons name="forum" size={22} color={Colors.outline} />
              <Text className="text-on-surface-variant text-sm">还没有评论，来抢沙发吧。</Text>
            </View>
          )}
        </View>

        <View style={{ height: 80 + insets.bottom }} />
      </ScrollView>

      <View
        style={{ paddingBottom: insets.bottom || 12 }}
        className="absolute bottom-0 left-0 right-0 bg-background border-t border-outline-variant/10 px-4 pt-3"
      >
        <View className="flex-row items-center gap-3">
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="写下你的评论..."
            placeholderTextColor={Colors.outline}
            editable={!commentSubmitting}
            className="flex-1 bg-surface-container-low rounded-full px-4 py-2.5 text-on-surface text-sm"
          />
          <Pressable
            onPress={handleSendComment}
            className={`w-10 h-10 rounded-full items-center justify-center ${commentSubmitting ? 'bg-primary/50' : 'bg-primary'} active:opacity-80`}
            disabled={!commentText.trim() || commentSubmitting}
          >
            <MaterialIcons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function PostContent({ post }: { post: Post }) {
  if (post.type === 'photo') {
    return (
      <View className="gap-3">
        {post.image ? (
          <Image source={{ uri: post.image }} style={{ width: '100%', height: 300, borderRadius: 16 }} contentFit="cover" transition={200} />
        ) : null}
        <Text className="text-on-surface text-[15px] leading-7">{post.caption}</Text>
        {post.location ? (
          <View className="flex-row items-center gap-1 mt-1">
            <MaterialIcons name="place" size={14} color={Colors.outline} />
            <Text className="text-outline text-xs">{post.location}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (post.type === 'brewing') {
    return (
      <View className="gap-4">
        <View className="flex-row items-center gap-2">
          <View className="bg-primary-container/20 px-2.5 py-1 rounded">
            <Text className="text-primary text-xs font-bold">冲泡分享</Text>
          </View>
          <Text className="text-on-surface-variant text-sm">{post.teaName}</Text>
        </View>
        {post.brewingImages?.length ? (
          <View className="flex-row gap-2">
            {post.brewingImages.map((image, index) => (
              <Image key={`${image}-${index}`} source={{ uri: image }} style={{ flex: 1, height: 160, borderRadius: 12 }} contentFit="cover" transition={200} />
            ))}
          </View>
        ) : null}
        {post.brewingData ? (
          <View className="bg-surface-container-low p-4 rounded-xl gap-3">
            <Text className="text-on-surface text-sm font-bold">冲泡参数</Text>
            <View className="flex-row gap-6">
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="thermostat" size={18} color={Colors.primary} />
                <Text className="text-on-surface text-sm">{post.brewingData.temp}</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="schedule" size={18} color={Colors.primary} />
                <Text className="text-on-surface text-sm">{post.brewingData.time}</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="scale" size={18} color={Colors.primary} />
                <Text className="text-on-surface text-sm">{post.brewingData.amount}</Text>
              </View>
            </View>
          </View>
        ) : null}
        {post.quote ? (
          <Text className="text-secondary italic text-[15px] leading-7 px-1">
            {"“"}
            {post.quote}
            {"”"}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="bg-tertiary-fixed self-start px-3 py-1 rounded-full">
        <Text className="text-on-surface text-xs font-bold">求助</Text>
      </View>
      <Text className="font-headline text-xl text-on-surface font-bold">{post.title}</Text>
      <Text className="text-on-surface/80 text-[15px] leading-7">{post.description}</Text>
    </View>
  );
}

function CommentItem({ comment, isLiked, onToggleLike }: { comment: Comment; isLiked: boolean; onToggleLike: () => void }) {
  return (
    <View className="flex-row gap-3 mb-5">
      <Image source={{ uri: comment.avatar }} style={{ width: 36, height: 36, borderRadius: 9999 }} contentFit="cover" />
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-on-surface text-sm font-bold">{comment.author}</Text>
          <Text className="text-outline text-[10px]">{comment.time}</Text>
        </View>
        <Text className="text-on-surface/90 text-sm leading-6 mt-1">{comment.content}</Text>
        <View className="flex-row items-center gap-1 mt-2">
          <Pressable onPress={onToggleLike} className="flex-row items-center gap-0.5" hitSlop={8}>
            <MaterialIcons name={isLiked ? 'favorite' : 'favorite-border'} size={14} color={isLiked ? Colors.error : Colors.outline} />
            <Text className="text-outline text-[11px]">{comment.likes}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
