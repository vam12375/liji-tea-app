import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import RelatedProducts from "@/components/community/RelatedProducts";
import { TeaImage } from "@/components/ui/TeaImage";
import { Colors } from "@/constants/Colors";
import { findRelatedProducts } from "@/lib/communityDiscovery";
import { shareContent } from "@/lib/share";
import { showModal } from "@/stores/modalStore";
import { useCommunityStore, type Comment } from "@/stores/communityStore";
import { useProductStore } from "@/stores/productStore";
import { useUserStore } from "@/stores/userStore";

function countAnswers(comments?: Comment[]): number {
  if (!comments?.length) {
    return 0;
  }

  return comments.reduce(
    (total, comment) => total + 1 + countAnswers(comment.replies),
    0,
  );
}

export default function CommunityQuestionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const posts = useCommunityStore((state) => state.posts);
  const activePost = useCommunityStore((state) => state.activePost);
  const likedCommentIds = useCommunityStore((state) => state.likedCommentIds);
  const bookmarkedPostIds = useCommunityStore(
    (state) => state.bookmarkedPostIds,
  );
  const detailLoading = useCommunityStore((state) => state.detailLoading);
  const fetchPostDetail = useCommunityStore((state) => state.fetchPostDetail);
  const addComment = useCommunityStore((state) => state.addComment);
  const toggleCommentLike = useCommunityStore(
    (state) => state.toggleCommentLike,
  );
  const togglePostBookmark = useCommunityStore(
    (state) => state.togglePostBookmark,
  );
  const products = useProductStore((state) => state.products);
  const fetchProducts = useProductStore((state) => state.fetchProducts);
  const session = useUserStore((state) => state.session);
  const post =
    activePost?.id === id ? activePost : posts.find((item) => item.id === id);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    void fetchPostDetail(id);
  }, [fetchPostDetail, id]);

  useEffect(() => {
    if (products.length === 0) {
      void fetchProducts();
    }
  }, [fetchProducts, products.length]);

  const answers = useMemo(() => post?.commentList ?? [], [post?.commentList]);
  const answerCount = useMemo(() => countAnswers(answers), [answers]);
  // 问答页先按提问文本做轻量挂品，后续再接真实“关联商品”字段。
  const relatedProducts = useMemo(
    () => (post ? findRelatedProducts(post, products, 3) : []),
    [post, products],
  );

  const requireLogin = () => {
    if (session?.user?.id) {
      return true;
    }

    showModal("请先登录", "登录后才可以回答问题或收藏问题。", "info");
    router.push("/login");
    return false;
  };

  const handleSubmitAnswer = async () => {
    const text = answerText.trim();
    if (!text || !post) {
      return;
    }
    if (!requireLogin()) {
      return;
    }

    try {
      setSubmitting(true);
      await addComment(post.id, text, replyTarget?.id);
      setAnswerText("");
      setReplyTarget(null);
      Keyboard.dismiss();
    } catch (error: any) {
      showModal("回答失败", error?.message ?? "请稍后重试。", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!post || !requireLogin()) {
      return;
    }

    try {
      await toggleCommentLike(post.id, commentId);
    } catch (error: any) {
      showModal("操作失败", error?.message ?? "请稍后重试。", "error");
    }
  };

  const handleToggleBookmark = async () => {
    if (!post || !requireLogin()) {
      return;
    }

    try {
      await togglePostBookmark(post.id);
    } catch (error: any) {
      showModal("收藏失败", error?.message ?? "请稍后重试。", "error");
    }
  };

  const handleShare = async () => {
    if (!post) {
      return;
    }

    try {
      await shareContent({
        path: `/post/${encodeURIComponent(post.id)}`,
        title: post.title ?? "茶友提问",
        lines: ["【李记茶铺问答】", post.description ?? ""],
      });
    } catch {
      // 用户取消分享时不需要额外提示。
    }
  };

  if ((!post || post.type !== "question") && detailLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3">
        <MaterialIcons name="hourglass-top" size={26} color={Colors.outline} />
        <Text className="text-on-surface-variant text-base">正在加载问题...</Text>
      </View>
    );
  }

  if (!post || post.type !== "question") {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-4 px-6">
        <MaterialIcons name="help-outline" size={30} color={Colors.outline} />
        <Text className="text-on-surface-variant text-base text-center">
          这个问题不存在，或已经被删除了。
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="px-6 py-2 bg-primary rounded-full"
        >
          <Text className="text-white text-sm font-medium">返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{ paddingTop: insets.top }}
        className="px-4 pb-3 bg-background border-b border-outline-variant/10"
      >
        <View className="flex-row items-center h-12">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center active:opacity-60"
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color={Colors.onSurface}
            />
          </Pressable>
          <Text className="flex-1 ml-2 text-on-surface text-lg font-bold">
            问题详情
          </Text>
          <View className="flex-row items-center gap-1">
            <Pressable
              hitSlop={8}
              onPress={handleToggleBookmark}
              className="w-10 h-10 items-center justify-center"
            >
              <MaterialIcons
                name={
                  bookmarkedPostIds.has(post.id) ? "bookmark" : "bookmark-border"
                }
                size={20}
                color={
                  bookmarkedPostIds.has(post.id)
                    ? Colors.primary
                    : Colors.onSurface
                }
              />
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={handleShare}
              className="w-10 h-10 items-center justify-center"
            >
              <MaterialIcons name="share" size={20} color={Colors.onSurface} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-5 gap-5">
          <View className="gap-3">
            <View className="bg-tertiary-fixed self-start px-3 py-1 rounded-full">
              <Text className="text-on-surface text-xs font-bold">问答</Text>
            </View>
            <Text className="font-headline text-xl text-on-surface font-bold">
              {post.title}
            </Text>
            <Text className="text-on-surface/80 text-[15px] leading-7">
              {post.description}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <TeaImage
              source={{ uri: post.avatar }}
              style={{ width: 32, height: 32, borderRadius: 9999 }}
              contentFit="cover"
            />
            <View className="flex-1">
              <Text className="text-on-surface text-sm font-bold">
                {post.author}
              </Text>
              <Text className="text-outline text-[11px]">
                {post.time} · {answerCount || post.comments} 条回答
              </Text>
            </View>
          </View>

          <View className="rounded-2xl bg-surface-container-low px-4 py-4 gap-2">
            <Text className="text-on-surface text-sm font-bold">回答提示</Text>
            <Text className="text-on-surface-variant text-xs leading-5">
              回答时尽量写清楚茶名、器具和冲泡参数，这样更容易帮助提问者做决定。
            </Text>
          </View>

          {relatedProducts.length > 0 ? (
            <RelatedProducts title="相关茶品" products={relatedProducts} />
          ) : null}

          <View className="gap-4 pb-2">
            <Text className="text-on-surface text-base font-bold">
              全部回答 ({answerCount || post.comments})
            </Text>

            {answers.length > 0 ? (
              answers.map((comment) => (
                <AnswerThreadItem
                  key={comment.id}
                  comment={comment}
                  likedCommentIds={likedCommentIds}
                  onReply={setReplyTarget}
                  onToggleLike={handleToggleCommentLike}
                />
              ))
            ) : (
              <View className="rounded-2xl bg-surface-container-low px-4 py-5 items-center gap-2">
                <MaterialIcons name="forum" size={22} color={Colors.outline} />
                <Text className="text-on-surface-variant text-sm text-center">
                  还没有人回答，写下你的经验，帮他少走一点弯路。
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 110 + insets.bottom }} />
      </ScrollView>

      <View
        style={{ paddingBottom: insets.bottom || 12 }}
        className="absolute bottom-0 left-0 right-0 bg-background border-t border-outline-variant/10 px-4 pt-3 gap-2"
      >
        {replyTarget ? (
          <View className="flex-row items-center justify-between rounded-full bg-surface-container-low px-4 py-2">
            <Text className="text-on-surface-variant text-xs">
              正在回复 {replyTarget.author}
            </Text>
            <Pressable hitSlop={8} onPress={() => setReplyTarget(null)}>
              <MaterialIcons name="close" size={16} color={Colors.outline} />
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row items-center gap-3">
          <TextInput
            value={answerText}
            onChangeText={setAnswerText}
            placeholder={replyTarget ? `回复 ${replyTarget.author}...` : "写下你的回答..."}
            placeholderTextColor={Colors.outline}
            editable={!submitting}
            multiline
            className="flex-1 bg-surface-container-low rounded-3xl px-4 py-3 text-on-surface text-sm min-h-12"
          />
          <Pressable
            onPress={handleSubmitAnswer}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              submitting ? "bg-primary/50" : "bg-primary"
            } active:opacity-80`}
            disabled={!answerText.trim() || submitting}
          >
            <MaterialIcons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function AnswerThreadItem({
  comment,
  likedCommentIds,
  onReply,
  onToggleLike,
  depth = 0,
}: {
  comment: Comment;
  likedCommentIds: Set<string>;
  onReply: (comment: Comment) => void;
  onToggleLike: (commentId: string) => void;
  depth?: number;
}) {
  return (
    <View
      className="gap-3"
      style={{ marginLeft: depth > 0 ? 20 : 0, marginBottom: 16 }}
    >
      <View className="rounded-3xl bg-surface-container-low px-4 py-4 flex-row gap-3">
        <TeaImage
          source={{ uri: comment.avatar }}
          style={{ width: 36, height: 36, borderRadius: 9999 }}
          contentFit="cover"
        />
        <View className="flex-1 gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-on-surface text-sm font-bold">
              {comment.author}
            </Text>
            <Text className="text-outline text-[10px]">{comment.time}</Text>
          </View>
          <Text className="text-on-surface/90 text-sm leading-6">
            {comment.content}
          </Text>
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={() => onToggleLike(comment.id)}
              className="flex-row items-center gap-1"
              hitSlop={8}
            >
              <MaterialIcons
                name={
                  likedCommentIds.has(comment.id) ? "favorite" : "favorite-border"
                }
                size={14}
                color={
                  likedCommentIds.has(comment.id)
                    ? Colors.error
                    : Colors.outline
                }
              />
              <Text className="text-outline text-[11px]">{comment.likes}</Text>
            </Pressable>
            <Pressable onPress={() => onReply(comment)} hitSlop={8}>
              <Text className="text-primary text-[11px] font-medium">回复</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {comment.replies?.length
        ? comment.replies.map((reply) => (
            <AnswerThreadItem
              key={reply.id}
              comment={reply}
              likedCommentIds={likedCommentIds}
              onReply={onReply}
              onToggleLike={onToggleLike}
              depth={depth + 1}
            />
          ))
        : null}
    </View>
  );
}
