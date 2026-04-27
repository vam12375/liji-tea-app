import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { goBackOrReplace } from "@/lib/navigation";

interface AppHeaderProps {
  title: string;
  shown?: boolean;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export function AppHeader({
  title,
  shown = true,
  showBackButton = true,
  onBackPress,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      {shown ? (
        <View
          style={{
            paddingTop: insets.top,
            paddingHorizontal: 12,
            paddingBottom: 6,
            backgroundColor: Colors.background,
          }}
        >
          <View
            style={{
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: Colors.onSurface,
                fontFamily: "Manrope_500Medium",
                fontSize: 16,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {showBackButton ? (
              <Pressable
                onPress={onBackPress ?? (() => goBackOrReplace(router))}
                hitSlop={10}
                style={{
                  position: "absolute",
                  left: 0,
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={Colors.onSurface}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );
}

export default AppHeader;
