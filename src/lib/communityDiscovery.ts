import { expandQueryTerms } from "@/lib/searchNormalize";
import type { Article } from "@/stores/articleStore";
import type { Post } from "@/stores/communityStore";
import type { Product } from "@/stores/productStore";

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function includesTerm(text: string, term: string) {
  return text.includes(term.toLowerCase());
}

function getPostSearchText(post: Post) {
  return normalizeText(
    [
      post.author,
      post.location,
      post.caption,
      post.teaName,
      post.quote,
      post.title,
      post.description,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getArticleSearchText(article: Article) {
  return normalizeText(
    [
      article.title,
      article.subtitle,
      article.category,
      ...(article.content ?? []).map(
        (block) => block.text ?? block.caption ?? "",
      ),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getProductSearchText(product: Product) {
  return normalizeText(
    [
      product.name,
      product.origin,
      product.category,
      product.tagline,
      product.description,
      product.originStory,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function scoreTerms(text: string, terms: string[]) {
  let score = 0;

  for (const term of terms) {
    if (!term) {
      continue;
    }

    if (includesTerm(text, term)) {
      score += term.length > 2 ? 2 : 1;
    }
  }

  return score;
}

// 首期没有真实标签字段时，先用内容本身推导一组轻量标签，支撑标签页和话题跳转。
export function getCommunityTagsFromPost(post: Post) {
  const tags = new Set<string>();

  if (post.type === "photo") {
    tags.add("晒图");
  }
  if (post.type === "question") {
    tags.add("问答");
  }
  if (post.type === "brewing") {
    tags.add("冲泡");
  }
  if (post.teaName) {
    tags.add(post.teaName);
  }
  if (post.location) {
    tags.add(post.location);
  }

  return [...tags];
}

// 标签页暂时走轻量匹配：命中推导标签或正文关键词都视为属于该标签。
export function postMatchesTag(post: Post, tag: string) {
  const normalizedTag = tag.toLowerCase();
  const searchText = getPostSearchText(post);

  return (
    getCommunityTagsFromPost(post).some(
      (candidate) => candidate.toLowerCase() === normalizedTag,
    ) || includesTerm(searchText, normalizedTag)
  );
}

export function articleMatchesTag(article: Article, tag: string) {
  return includesTerm(getArticleSearchText(article), tag.toLowerCase());
}

// 统一搜索里的社区结果先走前端轻量打分，避免本轮引入新的复杂检索索引。
export function searchCommunityPosts(posts: Post[], query: string) {
  const terms = expandQueryTerms(query).map((term) => term.toLowerCase());
  if (terms.length === 0) {
    return [];
  }

  return posts
    .map((post) => ({
      post,
      score: scoreTerms(getPostSearchText(post), terms),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.post);
}

export function searchArticles(articles: Article[], query: string) {
  const terms = expandQueryTerms(query).map((term) => term.toLowerCase());
  if (terms.length === 0) {
    return [];
  }

  return articles
    .map((article) => ({
      article,
      score: scoreTerms(getArticleSearchText(article), terms),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.article);
}

// 内容详情和问题详情先通过文本关键词推商品，后续再切到真实挂品字段。
export function findRelatedProducts(
  post: Pick<
    Post,
    "caption" | "teaName" | "quote" | "title" | "description" | "type"
  >,
  products: Product[],
  limit = 3,
) {
  const rawQuery =
    post.type === "brewing"
      ? `${post.teaName ?? ""} ${post.quote ?? ""}`
      : `${post.title ?? ""} ${post.description ?? ""} ${post.caption ?? ""}`;
  const terms = expandQueryTerms(rawQuery)
    .map((term) => term.toLowerCase())
    .slice(0, 10);

  if (terms.length === 0) {
    return [];
  }

  return products
    .map((product) => ({
      product,
      score: scoreTerms(getProductSearchText(product), terms),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.product);
}
