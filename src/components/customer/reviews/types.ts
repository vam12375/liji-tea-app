/**
 * 我的评价页内部使用的草稿形状。
 *
 * - `images` 字段在"待评价"场景里带 base64（用于上传到存储），
 *   在"已评价-编辑"场景里仅有 uri（存储端已有 URL）。
 */
export interface ReviewDraftImage {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface ReviewDraft {
  rating: number;
  content: string;
  tags: string[];
  isAnonymous: boolean;
  images: ReviewDraftImage[];
}

export const EMPTY_REVIEW_DRAFT: ReviewDraft = {
  rating: 5,
  content: "",
  tags: [],
  isAnonymous: false,
  images: [],
};
