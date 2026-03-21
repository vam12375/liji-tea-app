export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  image: string;
  readTime: string;
  date: string;
}

export const CULTURE_CATEGORIES = ["全部", "茶史", "冲泡", "茶器", "茶人", "节气茶", "产地"] as const;
export type CultureCategory = (typeof CULTURE_CATEGORIES)[number];

export const articles: Article[] = [
  {
    id: "a1",
    title: "宋代点茶：一碗沫浆的千年风雅",
    subtitle: "从建盏到茶筅，探索宋人的极致美学",
    category: "茶史",
    image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=800",
    readTime: "8分钟",
    date: "2024.03.15",
  },
  {
    id: "a2",
    title: "高山云雾：探访大红袍的起源之地",
    subtitle: "武夷山的丹霞地貌如何造就岩茶传奇",
    category: "产地",
    image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800",
    readTime: "5分钟",
    date: "2024.03.12",
  },
  {
    id: "a3",
    title: "紫砂壶的呼吸：如何挑选第一把好壶",
    subtitle: "从泥料到工艺，新手选壶指南",
    category: "茶器",
    image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800",
    readTime: "6分钟",
    date: "2024.03.10",
  },
  {
    id: "a4",
    title: "春水煎茶：明前龙井的鲜甜奥秘",
    subtitle: "清明前后，一杯绿茶的时令之美",
    category: "冲泡",
    image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800",
    readTime: "4分钟",
    date: "2024.03.08",
  },
  {
    id: "a5",
    title: "陆羽传：茶圣的一生与《茶经》",
    subtitle: "中国茶文化的开山之作背后的故事",
    category: "茶人",
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800",
    readTime: "10分钟",
    date: "2024.03.05",
  },
  {
    id: "a6",
    title: "春分宜饮：时令养生茶推荐",
    subtitle: "顺应节气，品味自然之道",
    category: "节气茶",
    image: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=800",
    readTime: "3分钟",
    date: "2024.03.20",
  },
];

export const seasonalPicks = [
  { name: "安吉白茶", desc: "清新鲜爽，春分首选", image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=200" },
  { name: "洞庭碧螺春", desc: "花果香馥，时令佳品", image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=200" },
];
