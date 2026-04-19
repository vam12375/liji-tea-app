import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { TeaImage } from "@/components/ui/TeaImage";
import { Colors } from "@/constants/Colors";
import { uploadCommunityMedia } from "@/lib/communityMedia";
import { REVIEW_TAG_SUGGESTIONS } from "@/lib/reviews";
import type { PendingReviewItem, ReviewDraftInput } from "@/lib/reviews";
import { showModal } from "@/stores/modalStore";

import type { ReviewDraft, ReviewDraftImage } from "./types";

interface Props {
  item: PendingReviewItem;
  draft: ReviewDraft;
  submitting: boolean;
  userId: string;
  /** 部分字段变更：父层按 orderItem.id 合并草稿。 */
  onDraftChange: (patch: Partial<ReviewDraft>) => void;
  /** 提交前本组件负责上传图片，成功后把最终 input 交给父层 submitReview。 */
  onSubmit: (input: ReviewDraftInput) => Promise<void>;
}

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * 待评价商品的评价提交卡片。
 * - 内含评分 / 标签 / 内容 / 晒图 / 匿名开关 / 提交按钮。
 * - 图片上传链路封装在本组件内，父层只消费最终 URL。
 */
export function PendingReviewCard({
  item,
  draft,
  submitting,
  userId,
  onDraftChange,
  onSubmit,
}: Props) {
  return (
    <View className="bg-surface-container-low rounded-3xl p-4 gap-4">
      <Header item={item} />

      <Section label="评分">
        <RatingStars
          rating={draft.rating}
          onChange={(rating) => onDraftChange({ rating })}
        />
      </Section>

      <Section label="评价标签">
        <TagPicker
          tags={draft.tags}
          onChange={(tags) => onDraftChange({ tags })}
        />
      </Section>

      <Section label="评价内容">
        <TextInput
          value={draft.content}
          onChangeText={(text) => onDraftChange({ content: text.slice(0, 200) })}
          placeholder="说说这款茶的香气、口感和包装体验..."
          placeholderTextColor={Colors.outline}
          multiline
          textAlignVertical="top"
          className="min-h-[96px] rounded-2xl bg-background px-4 py-3 text-on-surface"
        />
      </Section>

      <ImageSection
        images={draft.images}
        onChange={(images) => onDraftChange({ images })}
      />

      <AnonymousToggle
        value={draft.isAnonymous}
        onChange={(isAnonymous) => onDraftChange({ isAnonymous })}
      />

      <Pressable
        disabled={submitting}
        onPress={async () => {
          try {
            // 若选择了本地图片，先上传到存储，再把最终 URL 提交给评价接口。
            const uploadedImages =
              draft.images.length > 0
                ? await Promise.all(
                    draft.images
                      .filter((image) => image.base64)
                      .map((image) =>
                        uploadCommunityMedia({
                          base64: image.base64 as string,
                          userId,
                          fileName: image.fileName,
                          mimeType: image.mimeType,
                          folder: "posts",
                        }),
                      ),
                  )
                : [];

            await onSubmit({
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
}

function Header({ item }: { item: PendingReviewItem }) {
  return (
    <View className="flex-row gap-3">
      <TeaImage
        source={{ uri: item.productImage ?? undefined }}
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          backgroundColor: Colors.surfaceContainer,
        }}
        contentFit="cover"
      />
      <View className="flex-1 gap-1.5">
        <Text className="text-on-surface font-bold text-base">
          {item.productName}
        </Text>
        <Text className="text-outline text-xs">
          订单时间：{new Date(item.createdAt).toLocaleDateString("zh-CN")}
        </Text>
        <Text className="text-on-surface-variant text-xs">
          购买数量：{item.orderItem.quantity}
        </Text>
      </View>
    </View>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-on-surface text-sm font-medium">{label}</Text>
      {children}
    </View>
  );
}

export function RatingStars({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (rating: number) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {[1, 2, 3, 4, 5].map((value) => (
        <Pressable key={value} onPress={() => onChange(value)}>
          <Text
            style={{
              fontSize: 24,
              color: value <= rating ? Colors.primary : Colors.outlineVariant,
            }}
          >
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TagPicker({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {REVIEW_TAG_SUGGESTIONS.map((tag) => {
        const selected = tags.includes(tag);
        return (
          <Pressable
            key={tag}
            onPress={() => {
              // 选中态切换：取消则移除，新增则追加并裁剪到 6 个以内。
              const nextTags = selected
                ? tags.filter((item) => item !== tag)
                : [...tags, tag].slice(0, 6);
              onChange(nextTags);
            }}
            className={`px-3 py-1.5 rounded-full border ${selected ? "bg-primary-container border-primary/20" : "bg-background border-outline-variant/20"}`}
          >
            <Text
              className={
                selected
                  ? "text-on-primary text-xs"
                  : "text-on-surface-variant text-xs"
              }
            >
              {tag}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AnonymousToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-background px-4 py-3">
      <Text className="text-on-surface text-sm">匿名评价</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: Colors.outlineVariant,
          true: Colors.primaryContainer,
        }}
        thumbColor="#fff"
      />
    </View>
  );
}

function ImageSection({
  images,
  onChange,
}: {
  images: ReviewDraftImage[];
  onChange: (images: ReviewDraftImage[]) => void;
}) {
  const handlePick = async () => {
    // 评价晒单前先申请相册权限，并限制最多选择 3 张图片。
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      showModal(
        "无法访问相册",
        "请先授予相册权限，再选择晒单图片。",
        "info",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      orderedSelection: true,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) {
      return;
    }

    const oversized = result.assets.find((asset) => {
      const approxBytes = (asset.base64?.length ?? 0) * 0.75;
      return approxBytes > MAX_IMAGE_BYTES;
    });

    if (oversized) {
      showModal(
        "图片过大",
        "单张晒单图片不能超过 5MB，请重新选择更小的图片。",
        "info",
      );
      return;
    }

    onChange(
      result.assets.slice(0, MAX_IMAGES).map((asset) => ({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      })),
    );
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-on-surface text-sm font-medium">晒单图片</Text>
        <Text className="text-outline text-xs">最多 {MAX_IMAGES} 张</Text>
      </View>
      <Pressable
        onPress={handlePick}
        className="rounded-2xl border-dashed border-outline-variant bg-background px-4 py-3 items-center"
      >
        <Text className="text-primary text-sm font-medium">选择晒单图片</Text>
      </Pressable>

      {images.length > 0 ? (
        <View className="flex-row flex-wrap gap-3">
          {images.map((image, index) => (
            <View key={`${image.uri}-${index}`} className="relative">
              <TeaImage
                source={{ uri: image.uri }}
                style={{ width: 84, height: 84, borderRadius: 16 }}
                contentFit="cover"
              />
              <Pressable
                onPress={() =>
                  onChange(images.filter((_, imageIndex) => imageIndex !== index))
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
  );
}
