export interface Story {
  id: string;
  name: string;
  avatar: string;
  isViewed: boolean;
}

export interface Post {
  id: string;
  type: "photo" | "brewing" | "question";
  author: string;
  avatar: string;
  time: string;
  location?: string;
  // 图文帖
  image?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  // 冲泡分享
  teaName?: string;
  brewingData?: { temp: string; time: string; amount: string };
  brewingImages?: string[];
  quote?: string;
  // 求助帖
  title?: string;
  description?: string;
  answerCount?: number;
}

export const stories: Story[] = [
  {
    id: "s1",
    name: "陆羽",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
    isViewed: false,
  },
  {
    id: "s2",
    name: "林清",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
    isViewed: false,
  },
  {
    id: "s3",
    name: "老陈",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
    isViewed: true,
  },
  {
    id: "s4",
    name: "小禾",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
    isViewed: false,
  },
];

export const posts: Post[] = [
  {
    id: "p1",
    type: "photo",
    author: "苏曼",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
    time: "2小时前",
    location: "杭州",
    image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800",
    caption: "晨起一盏西湖龙井，叶片在水中翩跹，是春天的味道。",
    likes: 128,
    comments: 24,
  },
  {
    id: "p2",
    type: "brewing",
    author: "顾先生",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
    time: "5小时前",
    teaName: "武夷岩茶",
    brewingData: { temp: "98°C", time: "30秒", amount: "8g" },
    brewingImages: [
      "https://images.unsplash.com/photo-1558160074-4d93e8e073a1?w=400",
      "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400",
    ],
    quote: "岩韵十足，回甘极快。",
  },
  {
    id: "p3",
    type: "question",
    author: "泡茶新手小白",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
    time: "昨天",
    title: "建盏需要如何\u201C养\u201D才会有七彩光？",
    description:
      "刚入手了一只油滴建盏，听说养好了会有七彩光，求大神指导正确的养盏方法！",
    answerCount: 12,
  },
];
