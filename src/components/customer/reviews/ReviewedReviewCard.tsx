import { Pressable, Text, TextInput, View } from "react-native";

import { TeaImage } from "@/components/ui/TeaImage";
import { Colors } from "@/constants/Colors";
import type { ReviewRecord, ReviewUpdateInput } from "@/lib/reviews";
import { showConfirm, showModal } from "@/stores/modalStore";

import {
  AnonymousToggle,
  RatingStars,
  TagPicker,
} from "./PendingReviewCard";
import type { ReviewDraft } from "./types";

interface Props {
  item: ReviewRecord;
  editing: boolean;
  draft: ReviewDraft;
  submitting: boolean;
  onDraftChange: (patch: Partial<ReviewDraft>) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (input: ReviewUpdateInput) => Promise<void>;
  onDelete: (reviewId: string) => Promise<void>;
}

/**
 * 已评价记录卡片。
 * - 默认展示：评分 / 标签 / 图片 / 正文。
 * - 进入 editing 态：复用 RatingStars / TagPicker / AnonymousToggle 编辑表单。
 * - 删除走 showConfirm 二次确认。
 */
export function ReviewedReviewCard({
  item,
  editing,
  draft,
  submitting,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: Props) {
  return (
    <View className="bg-surface-container-low rounded-3xl p-4 gap-3">
      <View className="flex-row gap-3 items-start">
        <TeaImage
          source={{ uri: item.product?.image_url ?? undefined }}
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            backgroundColor: Colors.surfaceContainer,
          }}
          contentFit="cover"
        />
        <View className="flex-1 gap-1">
          <Text className="text-on-surface font-bold text-base">
            {item.product?.name ?? "商品评价"}
          </Text>
          <Text className="text-primary text-sm">
            {"★".repeat(item.rating)}
            {"☆".repeat(5 - item.rating)}
          </Text>
          <Text className="text-outline text-xs">
            {new Date(item.created_at).toLocaleString("zh-CN")}
          </Text>
        </View>
        <View className="gap-2">
          <Pressable onPress={onStartEdit}>
            <Text className="text-primary text-xs font-medium">编辑</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              showConfirm(
                "删除评价",
                "确定删除这条评价吗？删除后将不可恢复。",
                async () => {
                  try {
                    await onDelete(item.id);
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
        <EditForm
          draft={draft}
          submitting={submitting}
          onDraftChange={onDraftChange}
          onCancel={onCancelEdit}
          onSave={async () => {
            try {
              await onSave({
                reviewId: item.id,
                rating: draft.rating,
                content: draft.content,
                tags: draft.tags,
                images: draft.images.map((image) => image.uri),
                isAnonymous: draft.isAnonymous,
              });
              showModal("更新成功", "评价内容已更新。", "success");
            } catch (error) {
              showModal(
                "更新失败",
                error instanceof Error ? error.message : "请稍后重试",
                "error",
              );
            }
          }}
        />
      ) : (
        <DisplayBody item={item} />
      )}
    </View>
  );
}

function EditForm({
  draft,
  submitting,
  onDraftChange,
  onCancel,
  onSave,
}: {
  draft: ReviewDraft;
  submitting: boolean;
  onDraftChange: (patch: Partial<ReviewDraft>) => void;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <View className="gap-3">
      <View className="gap-2">
        <Text className="text-on-surface text-sm font-medium">评分</Text>
        <RatingStars
          rating={draft.rating}
          onChange={(rating) => onDraftChange({ rating })}
        />
      </View>

      <View className="gap-2">
        <Text className="text-on-surface text-sm font-medium">评价标签</Text>
        <TagPicker
          tags={draft.tags}
          onChange={(tags) => onDraftChange({ tags })}
        />
      </View>

      <TextInput
        value={draft.content}
        onChangeText={(text) => onDraftChange({ content: text.slice(0, 200) })}
        placeholder="修改你的评价内容..."
        placeholderTextColor={Colors.outline}
        multiline
        textAlignVertical="top"
        className="min-h-[96px] rounded-2xl bg-background px-4 py-3 text-on-surface"
      />

      <AnonymousToggle
        value={draft.isAnonymous}
        onChange={(isAnonymous) => onDraftChange({ isAnonymous })}
      />

      <View className="flex-row gap-3">
        <Pressable
          onPress={onCancel}
          className="flex-1 rounded-full border-outline-variant py-3 items-center"
        >
          <Text className="text-outline font-medium">取消</Text>
        </Pressable>
        <Pressable
          disabled={submitting}
          onPress={() => void onSave()}
          className={`flex-1 rounded-full py-3 items-center ${submitting ? "bg-primary/50" : "bg-primary-container"}`}
        >
          <Text className="text-on-primary font-medium">保存修改</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DisplayBody({ item }: { item: ReviewRecord }) {
  return (
    <>
      {item.tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {item.tags.map((tag) => (
            <View
              key={tag}
              className="px-3 py-1 rounded-full bg-primary-container/20"
            >
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
        <Text className="text-on-surface-variant text-sm leading-6">
          {item.content}
        </Text>
      ) : (
        <Text className="text-outline text-sm">用户未填写文字评价</Text>
      )}
    </>
  );
}
