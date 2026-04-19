import { useEffect, useMemo, useState } from "react";
import { TeaImage } from "@/components/ui/TeaImage";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams } from "expo-router";
import { View, Text, FlatList, Pressable, TextInput, Switch } from "react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { Colors } from "@/constants/Colors";
import { REVIEW_TAG_SUGGESTIONS } from "@/lib/reviews";
import { uploadCommunityMedia } from "@/lib/communityMedia";
import { routes } from "@/lib/routes";
import { showConfirm, showModal } from "@/stores/modalStore";
import { useReviewStore } from "@/stores/reviewStore";
import { useUserStore } from "@/stores/userStore";

/** 我的评价页顶部标签：区分待评价与已评价两个主视图。 */
const TABS = ["待评价", "已评价"] as const;
/** 已评价列表的快捷筛选项。 */
const REVIEW_FILTERS = ["最新", "好评", "晒图"] as const;
type ReviewTab = (typeof TABS)[number];
type ReviewFilter = (typeof REVIEW_FILTERS)[number];

export default function MyReviewsScreen() {
  const { productId, initialTab } = useLocalSearchParams<{
    productId?: string;
    initialTab?: ReviewTab;
  }>();
  const session = useUserStore((state) => state.session);
  const pendingReviewItems = useReviewStore((state) => state.pendingReviewItems);
  const myReviews = useReviewStore((state) => state.myReviews);
  const loading = useReviewStore((state) => state.loading);
  const submitting = useReviewStore((state) => state.submitting);
  const fetchPendingReviewItems = useReviewStore((state) => state.fetchPendingReviewItems);
  const fetchMyReviews = useReviewStore((state) => state.fetchMyReviews);
  const submitReview = useReviewStore((state) => state.submitReview);
  const updateReview = useReviewStore((state) => state.updateReview);
  const deleteReview = useReviewStore((state) => state.deleteReview);

  const [activeTab, setActiveTab] = useState<ReviewTab>(
    initialTab === "已评价" ? "已评价" : "待评价",
  );
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("最新");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [draftByOrderItemId, setDraftByOrderItemId] = useState<
    Record<
      string,
      {
        rating: number;
        content: string;
        tags: string[];
        isAnonymous: boolean;
        images: { uri: string; base64?: string | null; mimeType?: string | null; fileName?: string | null }[];
      }
    >
  >({});

  /** 登录后并行加载待评价列表与我的历史评价。 */
  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    void Promise.all([fetchPendingReviewItems(), fetchMyReviews()]);
  }, [fetchMyReviews, fetchPendingReviewItems, session?.user?.id]);

  useEffect(() => {
    if (initialTab === "已评价") {
      setActiveTab("已评价");
    }
  }, [initialTab]);

  /**
   * 已评价列表支持按商品范围与筛选项二次过滤。
   * 如果从商品详情进入，会优先只展示当前商品的评价。
   */
  const filteredReviews = useMemo(() => {
    const scopedReviews = productId
      ? myReviews.filter((item) => item.product?.id === productId)
      : myReviews;

    switch (reviewFilter) {
      case "好评":
        return scopedReviews
          .filter((item) => item.rating >= 4)
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
      case "晒图":
        return scopedReviews
          .filter((item) => item.images.length > 0)
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
      case "最新":
      default:
        return [...scopedReviews].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }
  }, [myReviews, productId, reviewFilter]);

  /** 根据当前主标签决定列表数据源。 */
  const currentList = useMemo(
    () => (activeTab === "待评价" ? pendingReviewItems : filteredReviews),
    [activeTab, filteredReviews, pendingReviewItems],
  );

  if (!session) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="我的评价" />
        <ScreenState
          variant="empty"
          title="登录后查看评价"
          description="订单完成后可在这里进行评价、查看历史晒单。"
          icon="rate-review"
          actionLabel="去登录"
          onAction={() => showModal("请先登录", "登录后即可查看待评价商品与历史评价。", "info")}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="我的评价" />

      <View className="px-4 pt-3 pb-2 gap-3">
        <View className="flex-row bg-surface-container-low rounded-full p-1">
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 rounded-full py-2.5 items-center ${active ? "bg-primary-container" : ""}`}
              >
                <Text className={active ? "text-on-primary font-medium" : "text-on-surface-variant"}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === "已评价" ? (
          <View className="flex-row gap-2">
            {REVIEW_FILTERS.map((filter) => {
              const active = reviewFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setReviewFilter(filter)}
                  className={`px-3 py-1.5 rounded-full border ${
                    active
                      ? "bg-primary-container border-primary/20"
                      : "bg-surface-container-low border-outline-variant/20"
                  }`}
                >
                  <Text
                    className={
                      active
                        ? "text-on-primary text-xs font-medium"
                        : "text-on-surface-variant text-xs"
                    }
                  >
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {loading && currentList.length === 0 ? (
        <ScreenState variant="loading" title="正在加载评价数据..." />
      ) : activeTab === "待评价" ? (
        <FlatList
          data={pendingReviewItems}
          keyExtractor={(item) => item.orderItem.id}
          contentContainerClassName="px-4 pb-10 gap-4"
          renderItem={({ item }) => {
            const draft =
              draftByOrderItemId[item.orderItem.id] ??
              ({ rating: 5, content: "", tags: [], isAnonymous: false, images: [] } as const);

            return (
              <View className="bg-surface-container-low rounded-3xl p-4 gap-4">
                <View className="flex-row gap-3">
                  <TeaImage
                    source={{ uri: item.productImage ?? undefined }}
                    style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: Colors.surfaceContainer }}
                    contentFit="cover"
                  />
                  <View className="flex-1 gap-1.5">
                    <Text className="text-on-surface font-bold text-base">{item.productName}</Text>
                    <Text className="text-outline text-xs">订单时间：{new Date(item.createdAt).toLocaleDateString("zh-CN")}</Text>
                    <Text className="text-on-surface-variant text-xs">购买数量：{item.orderItem.quantity}</Text>
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-on-surface text-sm font-medium">评分</Text>
                  <View className="flex-row gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable
                        key={value}
                        onPress={() =>
                          setDraftByOrderItemId((state) => ({
                            ...state,
                            [item.orderItem.id]: { ...draft, rating: value },
                          }))
                        }
                      >
                        <Text style={{ fontSize: 24, color: value <= draft.rating ? Colors.primary : Colors.outlineVariant }}>
                          ★
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-on-surface text-sm font-medium">评价标签</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {REVIEW_TAG_SUGGESTIONS.map((tag) => {
                      const selected = draft.tags.includes(tag);
                      return (
                        <Pressable
                          key={tag}
                          onPress={() =>
                            setDraftByOrderItemId((state) => {
                              const nextTags = selected
                                ? draft.tags.filter((itemTag) => itemTag !== tag)
                                : [...draft.tags, tag].slice(0, 6);
                              return {
                                ...state,
                                [item.orderItem.id]: { ...draft, tags: nextTags },
                              };
                            })
                          }
                          className={`px-3 py-1.5 rounded-full border ${selected ? "bg-primary-container border-primary/20" : "bg-background border-outline-variant/20"}`}
                        >
                          <Text className={selected ? "text-on-primary text-xs" : "text-on-surface-variant text-xs"}>
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-on-surface text-sm font-medium">评价内容</Text>
                  <TextInput
                    value={draft.content}
                    onChangeText={(text) =>
                      setDraftByOrderItemId((state) => ({
                        ...state,
                        [item.orderItem.id]: { ...draft, content: text.slice(0, 200) },
                      }))
                    }
                    placeholder="说说这款茶的香气、口感和包装体验..."
                    placeholderTextColor={Colors.outline}
                    multiline
                    textAlignVertical="top"
                    className="min-h-[96px] rounded-2xl bg-background px-4 py-3 text-on-surface"
                  />
                </View>

                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-on-surface text-sm font-medium">晒单图片</Text>
                    <Text className="text-outline text-xs">最多 3 张</Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      // 评价晒单前先申请相册权限，并限制最多选择 3 张图片。
                      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (permission.status !== "granted") {
                        showModal("无法访问相册", "请先授予相册权限，再选择晒单图片。", "info");
                        return;
                      }

                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ["images"],
                        allowsMultipleSelection: true,
                        selectionLimit: 3,
                        orderedSelection: true,
                        quality: 0.8,
                        base64: true,
                      });

                      if (result.canceled) {
                        return;
                      }

                      const oversizedAsset = result.assets.find((asset) => {
                        const approxBytes = (asset.base64?.length ?? 0) * 0.75;
                        return approxBytes > 5 * 1024 * 1024;
                      });

                      if (oversizedAsset) {
                        showModal(
                          "图片过大",
                          "单张晒单图片不能超过 5MB，请重新选择更小的图片。",
                          "info",
                        );
                        return;
                      }

                      setDraftByOrderItemId((state) => ({
                        ...state,
                        [item.orderItem.id]: {
                          ...draft,
                          images: result.assets.slice(0, 3).map((asset) => ({
                            uri: asset.uri,
                            base64: asset.base64,
                            mimeType: asset.mimeType,
                            fileName: asset.fileName,
                          })),
                        },
                      }));
                    }}
                    className="rounded-2xl border-dashed border-outline-variant bg-background px-4 py-3 items-center"
                  >
                    <Text className="text-primary text-sm font-medium">选择晒单图片</Text>
                  </Pressable>

                  {draft.images.length > 0 ? (
                    <View className="flex-row flex-wrap gap-3">
                      {draft.images.map((image, index) => (
                        <View key={`${image.uri}-${index}`} className="relative">
                          <TeaImage
                            source={{ uri: image.uri }}
                            style={{ width: 84, height: 84, borderRadius: 16 }}
                            contentFit="cover"
                          />
                          <Pressable
                            onPress={() =>
                              setDraftByOrderItemId((state) => ({
                                ...state,
                                [item.orderItem.id]: {
                                  ...draft,
                                  images: draft.images.filter((_, imageIndex) => imageIndex !== index),
                                },
                              }))
                            }
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 items-center justify-center"
                          >
                            <MaterialIcons name="close" size={14} color="#fff" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View className="flex-row items-center justify-between rounded-2xl bg-background px-4 py-3">
                  <Text className="text-on-surface text-sm">匿名评价</Text>
                  <Switch
                    value={draft.isAnonymous}
                    onValueChange={(value) =>
                      setDraftByOrderItemId((state) => ({
                        ...state,
                        [item.orderItem.id]: { ...draft, isAnonymous: value },
                      }))
                    }
                    trackColor={{ false: Colors.outlineVariant, true: Colors.primaryContainer }}
                    thumbColor="#fff"
                  />
                </View>

                <Pressable
                  disabled={submitting}
                  onPress={async () => {
                    try {
                      // 若选择了本地图片，先上传到存储，再把最终 URL 提交给评价接口。
                      const uploadedImages =
                        session?.user?.id && draft.images.length > 0
                          ? await Promise.all(
                              draft.images
                                .filter((image) => image.base64)
                                .map((image) =>
                                  uploadCommunityMedia({
                                    base64: image.base64 as string,
                                    userId: session.user.id,
                                    fileName: image.fileName,
                                    mimeType: image.mimeType,
                                    folder: "posts",
                                  }),
                                ),
                            )
                          : [];

                      await submitReview({
                        order: item.order,
                        orderItem: item.orderItem,
                        rating: draft.rating,
                        content: draft.content,
                        tags: draft.tags,
                        images: uploadedImages,
                        isAnonymous: draft.isAnonymous,
                      });
                      showModal("评价成功", "感谢你的反馈，评价已提交。", "success");
                    } catch (error) {
                      showModal(
                        "评价失败",
                        error instanceof Error ? error.message : "请稍后重试",
                        "error",
                      );
                    }
                  }}
                  className={`rounded-full py-3 items-center ${submitting ? "bg-primary/50" : "bg-primary-container"}`}
                >
                  <Text className="text-on-primary font-medium">提交评价</Text>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <ScreenState
              variant="empty"
              title="暂无待评价商品"
              description="已完成的订单商品会出现在这里。"
              icon="inventory"
              actionLabel="去逛逛"
              onAction={() => showModal("提示", `可以先去商城看看：${routes.shop()}`, "info")}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-10 gap-4"
          renderItem={({ item }) => {
            const editing = editingReviewId === item.id;
            // 编辑态草稿沿用统一草稿结构，便于复用表单与本地回显。
            const reviewDraft =
              draftByOrderItemId[item.id] ??
              {
                rating: item.rating,
                content: item.content ?? "",
                tags: item.tags,
                isAnonymous: item.is_anonymous,
                images: item.images.map((image) => ({ uri: image })),
              };

            return (
              <View className="bg-surface-container-low rounded-3xl p-4 gap-3">
                <View className="flex-row gap-3 items-start">
                  <TeaImage
                    source={{ uri: item.product?.image_url ?? undefined }}
                    style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.surfaceContainer }}
                    contentFit="cover"
                  />
                  <View className="flex-1 gap-1">
                    <Text className="text-on-surface font-bold text-base">{item.product?.name ?? "商品评价"}</Text>
                    <Text className="text-primary text-sm">{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</Text>
                    <Text className="text-outline text-xs">{new Date(item.created_at).toLocaleString("zh-CN")}</Text>
                  </View>
                  <View className="gap-2">
                    <Pressable
                      onPress={() => {
                        setEditingReviewId(item.id);
                        setDraftByOrderItemId((state) => ({
                          ...state,
                          [item.id]: {
                            rating: item.rating,
                            content: item.content ?? "",
                            tags: [...item.tags],
                            isAnonymous: item.is_anonymous,
                            images: item.images.map((image) => ({ uri: image })),
                          },
                        }));
                      }}
                    >
                      <Text className="text-primary text-xs font-medium">编辑</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        showConfirm(
                          "删除评价",
                          "确定删除这条评价吗？删除后将不可恢复。",
                          async () => {
                            try {
                              await deleteReview(item.id);
                              showModal("已删除", "评价已成功删除。", "success");
                            } catch (error) {
                              showModal(
                                "删除失败",
                                error instanceof Error ? error.message : "请稍后重试",
                                "error",
                              );
                            }
                          },
                          {
                            icon: "delete",
                            confirmText: "删除",
                            confirmStyle: "destructive",
                          },
                        )
                      }
                    >
                      <Text className="text-error text-xs font-medium">删除</Text>
                    </Pressable>
                  </View>
                </View>

                {editing ? (
                  <View className="gap-3">
                    <View className="gap-2">
                      <Text className="text-on-surface text-sm font-medium">评分</Text>
                      <View className="flex-row gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Pressable
                            key={value}
                            onPress={() =>
                              setDraftByOrderItemId((state) => ({
                                ...state,
                                [item.id]: { ...reviewDraft, rating: value },
                              }))
                            }
                          >
                            <Text style={{ fontSize: 24, color: value <= reviewDraft.rating ? Colors.primary : Colors.outlineVariant }}>
                              ★
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View className="gap-2">
                      <Text className="text-on-surface text-sm font-medium">评价标签</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {REVIEW_TAG_SUGGESTIONS.map((tag) => {
                          const selected = reviewDraft.tags.includes(tag);
                          return (
                            <Pressable
                              key={tag}
                              onPress={() =>
                                setDraftByOrderItemId((state) => ({
                                  ...state,
                                  [item.id]: {
                                    ...reviewDraft,
                                    tags: selected
                                      ? reviewDraft.tags.filter((itemTag) => itemTag !== tag)
                                      : [...reviewDraft.tags, tag].slice(0, 6),
                                  },
                                }))
                              }
                              className={`px-3 py-1.5 rounded-full border ${selected ? "bg-primary-container border-primary/20" : "bg-background border-outline-variant/20"}`}
                            >
                              <Text className={selected ? "text-on-primary text-xs" : "text-on-surface-variant text-xs"}>
                                {tag}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <TextInput
                      value={reviewDraft.content}
                      onChangeText={(text) =>
                        setDraftByOrderItemId((state) => ({
                          ...state,
                          [item.id]: { ...reviewDraft, content: text.slice(0, 200) },
                        }))
                      }
                      placeholder="修改你的评价内容..."
                      placeholderTextColor={Colors.outline}
                      multiline
                      textAlignVertical="top"
                      className="min-h-[96px] rounded-2xl bg-background px-4 py-3 text-on-surface"
                    />

                    <View className="flex-row items-center justify-between rounded-2xl bg-background px-4 py-3">
                      <Text className="text-on-surface text-sm">匿名评价</Text>
                      <Switch
                        value={reviewDraft.isAnonymous}
                        onValueChange={(value) =>
                          setDraftByOrderItemId((state) => ({
                            ...state,
                            [item.id]: { ...reviewDraft, isAnonymous: value },
                          }))
                        }
                        trackColor={{ false: Colors.outlineVariant, true: Colors.primaryContainer }}
                        thumbColor="#fff"
                      />
                    </View>

                    <View className="flex-row gap-3">
                      <Pressable
                        onPress={() => setEditingReviewId(null)}
                        className="flex-1 rounded-full border-outline-variant py-3 items-center"
                      >
                        <Text className="text-outline font-medium">取消</Text>
                      </Pressable>
                      <Pressable
                        disabled={submitting}
                        onPress={async () => {
                          try {
                            await updateReview({
                              reviewId: item.id,
                              rating: reviewDraft.rating,
                              content: reviewDraft.content,
                              tags: reviewDraft.tags,
                              images: reviewDraft.images.map((image) => image.uri),
                              isAnonymous: reviewDraft.isAnonymous,
                            });
                            setEditingReviewId(null);
                            showModal("更新成功", "评价内容已更新。", "success");
                          } catch (error) {
                            showModal(
                              "更新失败",
                              error instanceof Error ? error.message : "请稍后重试",
                              "error",
                            );
                          }
                        }}
                        className={`flex-1 rounded-full py-3 items-center ${submitting ? "bg-primary/50" : "bg-primary-container"}`}
                      >
                        <Text className="text-on-primary font-medium">保存修改</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    {item.tags.length > 0 ? (
                      <View className="flex-row flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <View key={tag} className="px-3 py-1 rounded-full bg-primary-container/20">
                            <Text className="text-primary text-xs">{tag}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {item.images.length > 0 ? (
                      <View className="flex-row flex-wrap gap-3">
                        {item.images.map((image, index) => (
                          <TeaImage
                            key={`${image}-${index}`}
                            source={{ uri: image }}
                            style={{ width: 84, height: 84, borderRadius: 16 }}
                            contentFit="cover"
                          />
                        ))}
                      </View>
                    ) : null}

                    {item.content ? (
                      <Text className="text-on-surface-variant text-sm leading-6">{item.content}</Text>
                    ) : (
                      <Text className="text-outline text-sm">用户未填写文字评价</Text>
                    )}
                  </>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <ScreenState
              variant="empty"
              title="还没有历史评价"
              description={
                productId
                  ? reviewFilter === "晒图"
                    ? "当前商品还没有带图片的历史评价。"
                    : "当前商品还没有符合筛选条件的历史评价。"
                  : reviewFilter === "晒图"
                    ? "你还没有上传过晒单图片。"
                    : reviewFilter === "好评"
                      ? "你还没有符合条件的好评记录。"
                      : "完成订单评价后，会在这里沉淀你的品饮反馈。"
              }
              icon="rate-review"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
