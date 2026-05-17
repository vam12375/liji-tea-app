import "../../global.css";
import { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { Stack, router } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import type { NotificationResponse } from "expo-notifications";
import { NotoSerifSC_400Regular } from "@expo-google-fonts/noto-serif-sc/400Regular";
import { NotoSerifSC_700Bold } from "@expo-google-fonts/noto-serif-sc/700Bold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";

import TeaModal from "@/components/ui/TeaModal";
import { Toast } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { initAnalyticsReporter } from "@/lib/analyticsReporter";
import { diagnoseAuthState } from "@/lib/authDiagnostics";
import { captureError, logInfo, registerCaptureHandler } from "@/lib/logger";
import { initCrashReporter, pushCrashReport } from "@/lib/crashReporter";
import {
  addPushNotificationListeners,
  extractPushNavigationData,
  handleLastNotificationResponse,
  navigateFromPushData,
} from "@/lib/pushNotifications";
import { logRuntimeDiagnostics } from "@/lib/runtimeDiagnostics";
import { setupSupabaseAutoRefresh, supabase } from "@/lib/supabase";
import { useCouponStore } from "@/stores/couponStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { usePushStore } from "@/stores/pushStore";
import { useUserStore } from "@/stores/userStore";

// 防止启动屏在字体加载前消失，避免首屏闪烁未加载字体的内容。
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoSerifSC_400Regular,
    NotoSerifSC_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });

  // 统一收口用户与优惠券初始化动作，方便登录态切换时做幂等控制。
  const setSession = useUserStore((state) => state.setSession);
  const setInitialized = useUserStore((state) => state.setInitialized);
  const fetchProfile = useUserStore((state) => state.fetchProfile);
  const fetchAddresses = useUserStore((state) => state.fetchAddresses);
  const fetchFavorites = useUserStore((state) => state.fetchFavorites);
  const fetchPublicCoupons = useCouponStore((state) => state.fetchPublicCoupons);
  const fetchUserCoupons = useCouponStore((state) => state.fetchUserCoupons);
  const resetCoupons = useCouponStore((state) => state.reset);
  const bootstrapPush = usePushStore((state) => state.bootstrap);
  const resetPush = usePushStore((state) => state.reset);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

  // 下面几个 ref 用来实现“同一用户只初始化一次”和“同一时刻只跑一条初始化链路”。
  const authBootstrapRequestIdRef = useRef(0);
  const bootstrappingUserIdRef = useRef<string | null>(null);
  const lastInitializedUserIdRef = useRef<string | null>(null);

  /**
   * 公开优惠券由根布局统一预取。
   * couponStore 内部已经做了 TTL 与并发去重，这里只负责在登录态切换时决定是否强制刷新。
   */
  const preloadPublicCoupons = useCallback(
    async (source: string, force = false) => {
      await fetchPublicCoupons(force ? { force: true } : undefined);
      logInfo("layout", "公开优惠券预取完成", { source, force });
    },
    [fetchPublicCoupons],
  );

  /**
   * 登录用户初始化链路：资料和地址是关键任务；收藏、优惠券、推送和通知为可降级任务。
   * 同一个 userId 已初始化或正在初始化时直接跳过，避免 getSession 与 onAuthStateChange 双触发。
   */
  const bootstrapAuthenticatedUser = useCallback(
    async (userId: string, source: string) => {
      if (lastInitializedUserIdRef.current === userId) {
        logInfo("layout", "跳过重复登录态初始化", {
          userId,
          source,
          reason: "already_initialized",
        });
        return;
      }

      if (bootstrappingUserIdRef.current === userId) {
        logInfo("layout", "跳过并发登录态初始化", {
          userId,
          source,
          reason: "initializing",
        });
        return;
      }

      const requestId = ++authBootstrapRequestIdRef.current;
      bootstrappingUserIdRef.current = userId;

      logInfo("layout", "开始初始化登录态数据", {
        userId,
        source,
        requestId,
      });

      try {
        // 每个异步阶段都校验当前用户和请求序号，避免旧 session 的结果覆盖新 session。
        const isCurrentBootstrap = () => {
          const currentUserId = useUserStore.getState().session?.user?.id ?? null;
          return (
            currentUserId === userId &&
            authBootstrapRequestIdRef.current === requestId
          );
        };

        // 关键任务：资料和地址失败会影响登录态页面的基础可用性，因此仍然阻断初始化完成标记。
        await Promise.all([fetchProfile(), fetchAddresses()]);

        if (!isCurrentBootstrap()) {
          const currentUserId = useUserStore.getState().session?.user?.id ?? null;
          logInfo("layout", "忽略过期登录态初始化结果", {
            userId,
            currentUserId,
            source,
            requestId,
          });
          return;
        }

        lastInitializedUserIdRef.current = userId;
        logInfo("layout", "登录态关键数据初始化完成", {
          userId,
          source,
          requestId,
        });

        // 可降级任务失败只影响局部体验，不影响资料/地址这些关键登录态数据完成。
        const degradableTasks: { name: string; run: () => Promise<unknown> }[] = [
          { name: "favorites", run: fetchFavorites },
          {
            name: "public_coupons",
            run: () => preloadPublicCoupons(`${source}:signed_in`),
          },
          { name: "user_coupons", run: fetchUserCoupons },
          { name: "notifications", run: fetchNotifications },
          { name: "push", run: () => bootstrapPush(userId) },
        ];

        // 每个可降级任务独立捕获异常，保证一个外围服务失败不会连带阻断其它预加载。
        const runDegradableTask = async (
          task: { name: string; run: () => Promise<unknown> },
        ) => {
          if (!isCurrentBootstrap()) {
            logInfo("layout", "跳过过期登录态可降级任务", {
              userId,
              source,
              requestId,
              taskName: task.name,
            });
            return;
          }

          try {
            await task.run();
            logInfo("layout", "登录态可降级任务完成", {
              userId,
              source,
              requestId,
              taskName: task.name,
            });
          } catch (error: unknown) {
            captureError(error, {
              scope: "layout",
              message: "登录态可降级任务失败",
              userId,
              source,
              requestId,
              taskName: task.name,
            });
          }
        };

        // 可降级任务后台执行；关键任务已完成，因此这里不 await，避免拖慢登录首屏。
        void Promise.all(degradableTasks.map(runDegradableTask)).then(() => {
          if (isCurrentBootstrap()) {
            logInfo("layout", "登录态可降级任务处理完成", {
              userId,
              source,
              requestId,
            });
          }
        });
      } catch (error: unknown) {
        captureError(error, {
          scope: "layout",
          message: "初始化登录态关键数据失败",
          userId,
          source,
          requestId,
        });

        // 开发态补充一次认证链路诊断，便于快速判断 session / token 是否异常。
        if (__DEV__) {
          void diagnoseAuthState();
        }
      } finally {
        if (bootstrappingUserIdRef.current === userId) {
          bootstrappingUserIdRef.current = null;
        }
      }
    },
    [
      bootstrapPush,
      fetchAddresses,
      fetchFavorites,
      fetchNotifications,
      fetchProfile,
      fetchUserCoupons,
      preloadPublicCoupons,
    ],
  );

  /**
   * 统一处理 session 解析结果，让 getSession 与 onAuthStateChange 复用同一套逻辑。
   * 这样可以避免两条入口各自维护一套初始化分支，降低重复触发风险。
   */
  const handleResolvedSession = useCallback(
    async (
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"],
      source: "getSession" | "auth_change",
    ) => {
      const previousUserId = useUserStore.getState().session?.user?.id ?? null;
      const nextUserId = session?.user?.id ?? null;
      const hadSession = Boolean(previousUserId);

      logInfo("layout", "处理认证状态变更", {
        source,
        previousUserId,
        nextUserId,
      });

      // 先写入 session，保证后续 store action 能读取到最新 userId。
      setSession(session);

      // initialized 只需要在根布局首次解析完 session 后置为 true。
      if (source === "getSession") {
        setInitialized();
      }

      if (nextUserId) {
        await bootstrapAuthenticatedUser(nextUserId, source);
        return;
      }

      // 进入未登录态时，主动让旧请求失效，并清空用户相关的初始化标记。
      authBootstrapRequestIdRef.current += 1;
      bootstrappingUserIdRef.current = null;
      lastInitializedUserIdRef.current = null;

      // 只有发生真实登出时才重置优惠券，再重新拉一次公开券；首次游客进入则复用缓存逻辑。
      if (hadSession) {
        resetCoupons();
      }

      resetPush();

      await preloadPublicCoupons(`${source}:signed_out`, hadSession);

      // 被动登出（token 过期等）时跳转登录页，主动未登录启动则不打断当前路由。
      if (source === "auth_change" && hadSession) {
        router.replace("/login");
      }
    },
    [
      bootstrapAuthenticatedUser,
      preloadPublicCoupons,
      resetCoupons,
      resetPush,
      setInitialized,
      setSession,
    ],
  );

  useEffect(() => {
    // 挂接 logger.captureError → 远端上报器的 transport，然后启动队列与定时 flush。
    registerCaptureHandler(pushCrashReport);
    void initCrashReporter();
    // 行为事件上报器：与崩溃上报同步启动，加载本地队列 + 每 30s 定时 flush。
    void initAnalyticsReporter();
    return () => {
      registerCaptureHandler(null);
    };
  }, []);

  useEffect(() => {
    // 启动时先输出运行环境和认证诊断，便于排查原生支付、Session 恢复等问题。
    logRuntimeDiagnostics();
    if (__DEV__) {
      void diagnoseAuthState();
    }
  }, []);

  useEffect(() => {
    const handleResponse = (response: NotificationResponse) => {
      const data = extractPushNavigationData(
        response.notification.request.content.data as Record<string, unknown> | undefined,
      );
      navigateFromPushData(data);
    };

    const cleanup = addPushNotificationListeners({
      onReceive: () => {
        const userId = useUserStore.getState().session?.user?.id;
        if (!userId) {
          return;
        }

        void fetchNotifications();
      },
      onResponse: handleResponse,
    });

    void handleLastNotificationResponse(handleResponse).catch((error) => {
      captureError(error, {
        scope: "layout",
        message: "读取最近一次推送响应失败",
      });
    });

    return cleanup;
  }, [fetchNotifications]);

  useEffect(() => {
    let active = true;

    // 启动阶段先读取本地 session，再根据结果走统一初始化逻辑。
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!active) {
          return;
        }

        void handleResolvedSession(session, "getSession");
      })
      .catch((error: unknown) => {
        captureError(error, {
          scope: "layout",
          message: "getSession 初始化失败",
        });
        setInitialized();
      });

    // 后续所有认证状态变化都复用同一个处理函数，避免逻辑分叉。
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      void handleResolvedSession(session, "auth_change");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [handleResolvedSession, setInitialized]);

  useEffect(() => {
    // 统一托管 Supabase token 自动刷新与 AppState 联动逻辑。
    const cleanup = setupSupabaseAutoRefresh();
    return cleanup;
  }, []);

  useEffect(() => {
    // 字体加载完成后再隐藏启动屏，避免首屏布局抖动。
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {/* 全局自定义弹窗保持挂载在根布局，便于任意页面直接调用。 */}
      <TeaModal />
      {/* 全局 Toast 单 slot，商家端与 C 端共用；scope 字段决定视觉主题。 */}
      <Toast />
    </ErrorBoundary>
  );
}
