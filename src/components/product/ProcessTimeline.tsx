import { View, Text } from "react-native";

interface ProcessTimelineProps {
  steps: string[];
}

export default function ProcessTimeline({ steps }: ProcessTimelineProps) {
  return (
    <View className="gap-4">
      <Text className="font-headline text-lg text-on-surface">制作工艺</Text>
      <View className="gap-0">
        {steps.map((step, index) => (
          <View key={step} className="flex-row items-start gap-4">
            {/* 时间线圆点 + 连线 */}
            <View className="items-center w-6">
              <View
                className={`w-3 h-3 rounded-full ${
                  index === 0 ? "bg-primary-container" : "bg-outline-variant"
                }`}
              />
              {index < steps.length - 1 && (
                <View className="w-px h-8 bg-outline-variant" />
              )}
            </View>
            {/* 步骤文字 */}
            <Text
              className={`text-sm pb-5 ${
                index === 0
                  ? "text-on-surface font-medium"
                  : "text-outline"
              }`}
            >
              {step}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
