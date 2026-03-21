export interface GiftCard {
  id: string;
  title: string;
  subtitle: string;
  image: string;
}

export interface GiftSet {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
}

export const giftCards: GiftCard[] = [
  { id: "g1", title: "感恩有你", subtitle: "以茶传情", image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=600" },
  { id: "g2", title: "生日快乐", subtitle: "岁月如茶", image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600" },
  { id: "g3", title: "新年吉祥", subtitle: "茶韵贺岁", image: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=600" },
  { id: "g4", title: "思念远方", subtitle: "一盏相思", image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=600" },
];

export const giftSets: GiftSet[] = [
  { id: "gs1", name: "入门品鉴套装", description: "精选3款经典茶品·含冲泡指南", price: 168, image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=200" },
  { id: "gs2", name: "匠心典藏礼盒", description: "6款名茶·紫砂壶·竹制茶盘", price: 398, image: "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=200" },
  { id: "gs3", name: "至臻年份珍藏", description: "10年陈普洱·手工建盏·锡罐", price: 888, image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=200" },
];

export const messageTags = ["感谢", "生日快乐", "新年吉祥", "思念"];
