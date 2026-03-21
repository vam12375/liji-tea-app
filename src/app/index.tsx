import { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const GOLD = "#C4A265";
const DARK = "#2C2C2C";

export default function SplashScreenPage() {
  const router = useRouter();
  const progressWidth = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 淡入动画
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // 进度条动画
    Animated.timing(progressWidth, {
      toValue: 1,
      duration: 2500,
      useNativeDriver: false,
    }).start();

    // 2.5秒后跳转到主页
    const timer = setTimeout(() => {
      router.replace("/(tabs)" as any);
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: DARK, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ opacity: fadeIn, alignItems: "center" }}>
        {/* Logo 圆环 */}
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            borderWidth: 1.5,
            borderColor: GOLD,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              borderWidth: 1,
              borderColor: `${GOLD}50`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons name="eco" size={40} color={GOLD} />
          </View>
        </View>

        {/* 品牌名 */}
        <Text
          style={{
            fontFamily: "NotoSerifSC_700Bold",
            color: GOLD,
            fontSize: 42,
            fontWeight: "bold",
            letterSpacing: 24,
            marginBottom: 16,
            paddingLeft: 24,
          }}
        >
          李记茶
        </Text>

        {/* 副标题 */}
        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            color: `${GOLD}99`,
            fontSize: 10,
            letterSpacing: 6,
            textTransform: "uppercase",
            marginBottom: 48,
          }}
        >
          LIJI TEA · EST. 2024
        </Text>

        {/* 标语 */}
        <Text
          style={{
            fontFamily: "NotoSerifSC_400Regular",
            color: "#f8f3eb80",
            fontSize: 14,
            letterSpacing: 12,
            paddingLeft: 12,
          }}
        >
          一叶一世界
        </Text>
      </Animated.View>

      {/* 底部进度条 */}
      <View
        style={{
          position: "absolute",
          bottom: 64,
          width: 128,
          height: 1,
          backgroundColor: `${GOLD}1A`,
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            backgroundColor: GOLD,
            borderRadius: 1,
            width: progressWidth.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "40%"],
            }),
            shadowColor: GOLD,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
          }}
        />
      </View>
    </View>
  );
}
