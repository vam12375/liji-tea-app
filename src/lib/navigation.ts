import type { Href } from "expo-router";

import { routes } from "@/lib/routes";

interface BackCapableRouter {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
}

/** 只有存在历史栈时才执行返回，否则回退到安全页面，避免 GO_BACK warning。 */
export function goBackOrReplace(
  router: BackCapableRouter,
  fallback: Href = routes.tabs,
) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
