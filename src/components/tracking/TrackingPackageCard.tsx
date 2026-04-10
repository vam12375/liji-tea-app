import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { trackingCopy } from "@/constants/copy";
import type { PackageSummary } from "@/lib/trackingUtils";
import type { Order } from "@/types/database";

interface TrackingPackageCardProps {
  order: Order;
  packageSummary: PackageSummary;
}

// 包裹摘要卡只关心商品缩略图、件数与礼盒包装摘要。
export function TrackingPackageCard({
  order,
  packageSummary,
}: TrackingPackageCardProps) {
  return (
    <View className="gap-4 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons
          name="inventory-2"
          size={18}
          color={Colors.primaryContainer}
        />
        <Text className="text-base font-bold text-on-surface">
          {trackingCopy.sections.package}
        </Text>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          {packageSummary.imageUrls.length > 0 ? (
            packageSummary.imageUrls.slice(0, 3).map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                contentFit="cover"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: Colors.surface,
                }}
              />
            ))
          ) : (
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-background">
              <MaterialIcons
                name="inventory-2"
                size={20}
                color={Colors.outline}
              />
            </View>
          )}
        </View>

        <Text className="text-sm font-medium text-on-surface">
          {packageSummary.title}
        </Text>
        <Text className="text-xs text-outline">
          {`${trackingCopy.packageSummary.itemCountPrefix} ${packageSummary.count} ${trackingCopy.packageSummary.itemCountSuffix}${
            order.gift_wrap
              ? ` · ${trackingCopy.packageSummary.giftWrapEnabled}`
              : ""
          }`}
        </Text>
      </View>
    </View>
  );
}
