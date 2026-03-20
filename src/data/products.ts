export interface Product {
  id: string;
  name: string;
  origin: string;
  price: number;
  image: string;
  description?: string;
  isNew?: boolean;
}

/** 本季推荐 */
export const featuredProducts: Product[] = [
  {
    id: "1",
    name: "西湖龙井 A级",
    origin: "杭州 西湖",
    price: 588,
    image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400",
  },
  {
    id: "2",
    name: "大红袍 特级",
    origin: "福建 武夷山",
    price: 1280,
    image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=400",
  },
  {
    id: "3",
    name: "安吉白茶",
    origin: "浙江 安吉",
    price: 420,
    image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400",
  },
];

/** 新品上市 */
export const newArrivals: Product[] = [
  {
    id: "4",
    name: "白毫银针 · 2024春",
    origin: "福建 福鼎",
    price: 899,
    description: "满披白毫，如银似雪，毫香幽显。",
    isNew: true,
    image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400",
  },
  {
    id: "5",
    name: "金骏眉 · 桐木关",
    origin: "福建 武夷山",
    price: 1580,
    description: "顶级红茶，花果蜜香，汤色金黄。",
    isNew: true,
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
  },
];
