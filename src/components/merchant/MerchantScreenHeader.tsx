import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";

interface Props {
  title: string;
  actionIcon?: keyof typeof MaterialIcons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}

// 商家端页面级大标题：左侧 Noto Serif SC 32pt 粗体，右侧可选 action 按钮。
// 下方留 12px 节奏空隙，交给父容器挂 Hero 数字 / 筛选栏。
export function MerchantScreenHeader({
  title,
  actionIcon,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <Text
        style={{
          color: MerchantColors.ink900,
          fontFamily: "NotoSerifSC_700Bold",
          fontSize: 32,
          lineHeight: 40,
        }}
      >
        {title}
      </Text>
      {onAction && actionIcon ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              transform: [{ scale: pressed ? 0.96 : 1 }],
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <MaterialIcons
            name={actionIcon}
            size={18}
            color={MerchantColors.ink500}
          />
          {actionLabel ? (
            <Text style={{ color: MerchantColors.ink500, fontSize: 13 }}>
              {actionLabel}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
