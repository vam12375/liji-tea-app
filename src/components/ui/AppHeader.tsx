import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useRouter } from "expo-router";
import { Pressable } from "react-native";

import { Colors } from "@/constants/Colors";
import { goBackOrReplace } from "@/lib/navigation";

interface AppHeaderProps {
  title: string;
  shown?: boolean;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

/**统一内页头部配置，避免每个页面重复拼装 Stack.Screen。 */
export function AppHeader({
  title,
  shown = true,
  showBackButton = true,
  onBackPress,
}: AppHeaderProps) {
  const router = useRouter();

  return (
<Stack.Screen
      options={{
        headerShown: shown,
        headerTitle: title,
        headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
        headerStyle: {backgroundColor: Colors.background },
        headerShadowVisible: false,
        headerLeft:
          shown && showBackButton
            ? () => (
                <Pressable
                  onPress={onBackPress ?? (() =>goBackOrReplace(router))}
                  hitSlop={8}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={24}
                    color={Colors.onSurface}
                  />
                </Pressable>
              )
            : undefined,
      }}
    />
  );
}

export default AppHeader;
