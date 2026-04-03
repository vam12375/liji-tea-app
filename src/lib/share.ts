import * as Linking from 'expo-linking';
import { Share } from 'react-native';

interface ShareContentOptions {
  path: string;
  title: string;
  lines: (string | null | undefined)[];
}

export async function shareContent({ path, title, lines }: ShareContentOptions) {
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

  await Share.share({
    title,
    message: shareLines.join('\n'),
    url: webLink ?? deepLink,
  });
}
