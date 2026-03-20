export interface TastingProfile {
  label: string;
  description: string;
  value: number; // 0-100
}

export interface BrewingGuide {
  temperature: string;
  time: string;
  amount: string;
  equipment: string;
}

export interface Product {
  id: string;
  name: string;
  origin: string;
  price: number;
  unit: string;
  image: string;
  description?: string;
  isNew?: boolean;
  category: string;
  tagline?: string;
  tastingProfile?: TastingProfile[];
  brewingGuide?: BrewingGuide;
  originStory?: string;
  process?: string[];
}

/** 商城完整产品列表 */
export const allProducts: Product[] = [
  {
    id: "1",
    name: "特级大红袍",
    origin: "福建·武夷山",
    price: 398,
    unit: "50g",
    image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=400",
    category: "岩茶",
    tagline: "岩骨花香，回甘悠长",
    tastingProfile: [
      { label: "香气", description: "兰花香", value: 85 },
      { label: "滋味", description: "醇厚饱满", value: 92 },
      { label: "回甘", description: "岩韵悠长", value: 78 },
    ],
    brewingGuide: {
      temperature: "98°C",
      time: "30秒",
      amount: "8g",
      equipment: "盖碗",
    },
    originStory:
      "武夷山独特的丹霞地貌，赋予岩茶独一无二的岩骨花香。生长于岩缝之间的茶树，根深叶茂，吸收矿物质丰富，造就了大红袍醇厚饱满的口感。",
    process: ["采摘", "萎凋", "做青", "炭焙"],
  },
  {
    id: "2",
    name: "西湖龙井",
    origin: "浙江·杭州",
    price: 256,
    unit: "50g",
    image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400",
    category: "绿茶",
    tagline: "色绿香郁味甘形美",
    tastingProfile: [
      { label: "香气", description: "豆花香", value: 90 },
      { label: "滋味", description: "鲜爽甘醇", value: 88 },
      { label: "回甘", description: "清新持久", value: 82 },
    ],
    brewingGuide: {
      temperature: "80°C",
      time: "45秒",
      amount: "5g",
      equipment: "玻璃杯",
    },
    originStory:
      "西湖龙井产于杭州西湖周围的群山之中，以色绿、香郁、味甘、形美四绝著称，位列中国十大名茶之首。",
    process: ["采摘", "摊放", "杀青", "辉锅"],
  },
  {
    id: "3",
    name: "古树普洱生茶",
    origin: "云南·勐海",
    price: 588,
    unit: "片",
    image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400",
    category: "普洱",
    tagline: "古树韵味，越陈越香",
    tastingProfile: [
      { label: "香气", description: "蜜兰香", value: 88 },
      { label: "滋味", description: "浓厚霸气", value: 95 },
      { label: "回甘", description: "深沉绵长", value: 90 },
    ],
    brewingGuide: {
      temperature: "100°C",
      time: "15秒",
      amount: "7g",
      equipment: "紫砂壶",
    },
    originStory:
      "勐海古茶山的百年古树，每一片茶叶都蕴含着时间的味道。古树根系深扎土壤，汲取丰富矿物质，造就浓厚霸气的口感。",
    process: ["采摘", "萎凋", "杀青", "压制"],
  },
  {
    id: "4",
    name: "白毫银针",
    origin: "福建·福鼎",
    price: 420,
    unit: "50g",
    image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400",
    category: "白茶",
    tagline: "满披白毫，如银似雪",
    isNew: true,
    tastingProfile: [
      { label: "香气", description: "毫香幽显", value: 80 },
      { label: "滋味", description: "清鲜淡雅", value: 75 },
      { label: "回甘", description: "甜润悠长", value: 85 },
    ],
    brewingGuide: {
      temperature: "85°C",
      time: "60秒",
      amount: "5g",
      equipment: "盖碗",
    },
    originStory:
      "福鼎白茶以白毫银针为最，取自大白茶品种的肥壮芽头，满披白毫，外形如银似雪，汤色杏黄明亮。",
    process: ["采摘", "萎凋", "干燥"],
  },
  {
    id: "5",
    name: "金骏眉红茶",
    origin: "福建·武夷山",
    price: 680,
    unit: "50g",
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
    category: "红茶",
    tagline: "花果蜜香，汤色金黄",
    isNew: true,
    tastingProfile: [
      { label: "香气", description: "花果蜜香", value: 93 },
      { label: "滋味", description: "甜润饱满", value: 90 },
      { label: "回甘", description: "蜜韵悠长", value: 88 },
    ],
    brewingGuide: {
      temperature: "90°C",
      time: "40秒",
      amount: "5g",
      equipment: "盖碗",
    },
    originStory:
      "金骏眉采用桐木关原生态小种红茶的芽尖制作，每500克成品需要约6万颗芽尖，是顶级红茶的代表。",
    process: ["采摘", "萎凋", "揉捻", "发酵", "烘焙"],
  },
  {
    id: "6",
    name: "特级茉莉花茶",
    origin: "广西·横县",
    price: 128,
    unit: "100g",
    image: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=400",
    category: "花茶",
    tagline: "窨得茉莉无上味，列作人间第一香",
    tastingProfile: [
      { label: "香气", description: "茉莉花香", value: 95 },
      { label: "滋味", description: "鲜灵甘爽", value: 82 },
      { label: "回甘", description: "花香回味", value: 80 },
    ],
    brewingGuide: {
      temperature: "85°C",
      time: "45秒",
      amount: "5g",
      equipment: "玻璃杯",
    },
    originStory:
      "横县茉莉花茶采用优质绿茶坯与含苞待放的茉莉花反复窨制而成，花香与茶香交融，堪称花茶之王。",
    process: ["选坯", "窨花", "通花", "起花", "复火"],
  },
];

/** 茶类分类 */
export const TEA_CATEGORIES = [
  "全部",
  "岩茶",
  "绿茶",
  "白茶",
  "红茶",
  "乌龙",
  "普洱",
  "花茶",
] as const;

export type TeaCategory = (typeof TEA_CATEGORIES)[number];

/** 保留向后兼容 - Sprint 1 首页使用 */
export const featuredProducts = allProducts.slice(0, 3);
export const newArrivals = allProducts.filter((p) => p.isNew);
