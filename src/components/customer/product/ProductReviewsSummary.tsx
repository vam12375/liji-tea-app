import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { routes } from "@/lib/routes";
import type { ReviewRecord } from "@/lib/reviews";

interface Props {
  productId: string;
  productReviews: ReviewRecord[];
}

/**
 * 商品详情页底部"茶友评价"聚合块。
 * - 独立计算摘要（总数 / 平均分 / 好评率）
 * - 显示前 3 条评价预览
 * - 侧边按钮跳转全部评价 / 我的评价
 */
export function ProductReviewsSummary({ productId, productReviews }: Props) {
  const router = useRouter();

  const summary = useMemo(
    () => ({
      total: productReviews.length,
      averageRating:
        productReviews.length > 0
          ? productReviews.reduce((sum, review) => sum + review.rating, 0) /
            productReviews.length
          : 0,
      positiveRate:
        productReviews.length > 0
          ? productReviews.filter((review) => review.rating >= 4).length /
            productReviews.length
          : 0,
      tags: [] as { label: string; count: number }[],
    }),
    [productReviews],
  );

  const preview = useMemo(
    () => productReviews.slice(0, 3),
    [productReviews],
  );

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <View className="gap-1">
          <Text className="font-headline text-lg text-on-surface font-bold">
            茶友评价
          </Text>
          <Text className="text-on-surface-variant text-xs">
            {summary.total > 0
              ? `综合评分 ${summary.averageRating} · 好评率 ${summary.positiveRate}%`
              : "还没有茶友评价，期待你的第一条反馈"}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push(routes.productReviews(productId))}
            className="px-3 py-2 rounded-full bg-surface-container-low active:opacity-70"
          >
            <Text className="text-primary text-xs font-medium">查看全部</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(routes.myReviews)}
            className="px-3 py-2 rounded-full bg-surface-container-low active:opacity-70"
          >
            <Text className="text-primary text-xs font-medium">去评价</Text>
          </Pressable>
        </View>
      </View>

      {summary.tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {summary.tags.map((tag) => (
            <View
              key={tag.label}
              className="px-3 py-1 rounded-full bg-primary-container/20"
            >
              <Text className="text-primary text-xs">
                {tag.label} · {tag.count}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {preview.length > 0 ? (
        <View className="gap-3">
          {preview.map((review) => (
            <View
              key={review.id}
              className="rounded-2xl bg-surface-container-low p-4 gap-2"
            >
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-on-surface text-sm font-medium">
                  {review.is_anonymous
                    ? "匿名茶友"
                    : review.user?.name ?? "茶友"}
                </Text>
                <Text className="text-primary text-sm">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </Text>
              </View>
              {review.tags.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {review.tags.map((tag) => (
                    <View
                      key={`${review.id}-${tag}`}
                      className="px-2.5 py-1 rounded-full bg-background"
                    >
                      <Text className="text-on-surface-variant text-[11px]">
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text className="text-on-surface-variant text-sm leading-6">
                {review.content?.trim() || "这位茶友暂未填写文字评价。"}
              </Text>
              <Text className="text-outline text-[11px]">
                {new Date(review.created_at).toLocaleDateString("zh-CN")}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View className="rounded-2xl bg-surface-container-low p-5 items-center gap-2">
          <MaterialIcons name="rate-review" size={24} color={Colors.outline} />
          <Text className="text-on-surface-variant text-sm text-center">
            暂无评价，购买后可前往「我的评价」提交晒单与口感反馈。
          </Text>
        </View>
      )}
    </View>
  );
}
