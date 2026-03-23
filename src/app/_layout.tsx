import "../../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { NotoSerifSC_400Regular } from "@expo-google-fonts/noto-serif-sc/400Regular";
import { NotoSerifSC_700Bold } from "@expo-google-fonts/noto-serif-sc/700Bold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/stores/userStore";
import TeaModal from "@/components/ui/TeaModal";

// 防止启动屏在字体加载前消失
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoSerifSC_400Regular,
    NotoSerifSC_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });

  // --- Supabase Auth 状态监听 ---
  const setSession = useUserStore((s) => s.setSession);
  const setInitialized = useUserStore((s) => s.setInitialized);
  const fetchProfile = useUserStore((s) => s.fetchProfile);
  const fetchAddresses = useUserStore((s) => s.fetchAddresses);
  const fetchFavorites = useUserStore((s) => s.fetchFavorites);

  useEffect(() => {
    // 加载现有 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized();
      if (session) {
        fetchProfile();
        fetchAddresses();
        fetchFavorites();
      }
    });

    // 监听 auth 状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile();
        fetchAddresses();
        fetchFavorites();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {/* 全局自定义弹窗 */}
      <TeaModal />
    </>
  );
}
