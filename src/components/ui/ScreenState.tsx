import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";

type ScreenStateVariant = "loading" | "empty" | "error";

interface ScreenStateProps {
  variant: ScreenStateVariant;
  title: string;
  description?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  onActionPress?:() => void;
  activityColor?: string;
}

/** 统一加载态、空态和错误态的视觉结构，减少页面重复 UI。 */
export function ScreenState({
  variant,
  title,
  description,
icon = variant === "error" ? "error-outline" : "inventory",
  actionLabel,
  onAction,
  onActionPress,
  activityColor = Colors.primary,
}: ScreenStateProps) {
const resolvedAction = onAction ?? onActionPress;

  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      {variant === "loading" ? (
        <ActivityIndicator size="large" color={activityColor}/>
      ) : (
        <View className="w-16 h-16 rounded-full bg-surface-container-low items-center justify-center">
          <MaterialIcons name={icon} size={30} color={Colors.outline} />
        </View>
      )}

      <View className="items-center gap-2">
        <Text className="text-on-surface text-base font-bold">{title}</Text>
        {description ? (
          <Text className="text-outline text-sm text-center leading-6">
            {description}
          </Text>
        ) : null}
      </View>

      {actionLabel && resolvedAction ? (
        <Pressable
          onPress={resolvedAction}
          className="bg-primary-container rounded-full px-5 py-3 active:bg-primary"
        >
          <Text className="text-on-primary font-medium">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default ScreenState;
