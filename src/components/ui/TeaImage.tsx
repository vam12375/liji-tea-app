import { Image, type ImageProps } from "expo-image";

/**
 * TeaImage —— 全项目图片入口组件。
 *
 * 统一注入两个默认值，减少首屏空白与二次访问抖动：
 *   - `cachePolicy="memory-disk"`：同图二次访问不走网络。
 *   - `transition={200}`：淡入，避免硬切。
 *
 * 所有默认值都可通过 props 覆盖。调用方可继续使用 expo-image 的全部能力。
 * 若需要静态方法（`clearDiskCache` / `prefetch`），请继续 `import { Image } from "expo-image"`。
 */
export type TeaImageProps = ImageProps;

export function TeaImage(props: TeaImageProps) {
  return <Image cachePolicy="memory-disk" transition={200} {...props} />;
}

export default TeaImage;
