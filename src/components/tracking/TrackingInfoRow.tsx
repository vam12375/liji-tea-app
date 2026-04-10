import { Text, View } from "react-native";

interface TrackingInfoRowProps {
  label: string;
  value: string;
}

// 统一两列表单项布局，减少各卡片重复写相同行样式。
export function TrackingInfoRow({ label, value }: TrackingInfoRowProps) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-outline text-xs">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-on-surface">
        {value}
      </Text>
    </View>
  );
}
