import * as Linking from 'expo-linking';
import { Share } from 'react-native';

import { track } from '@/lib/analytics';

interface ShareContentOptions {
  path: string;
  title: string;
  lines: (string | null | undefined)[];
  /** 发起分享的业务场景标识，用于后续按触点细分裂变来源。 */
  source?: string;
}

export async function shareContent({ path, title, lines, source }: ShareContentOptions) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const deepLink = Linking.createURL(normalizedPath, {
    scheme: 'lijiteaapp',
  });
  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim().replace(/\/+$/, '');
  const webLink = webBaseUrl ? `${webBaseUrl}${normalizedPath}` : null;
  const shareLines = lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));

  if (webLink) {
    shareLines.push(`网页阅读：${webLink}`);
  }

  shareLines.push(`App 打开：${deepLink}`);

  // 分享发起埋点：Share.share 自身不返回可靠取消信号（iOS/Android 表现不一），
  // 这里只记录"触发了分享入口"，裂变转化统计由带回 deepLink 的入口冷启事件完成。
  track('share_triggered', {
    source: source ?? null,
    path: normalizedPath,
    hasWebLink: Boolean(webLink),
  });

  await Share.share({
    title,
    message: shareLines.join('\n'),
    url: webLink ?? deepLink,
  });
}
