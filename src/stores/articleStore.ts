import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Article as DBArticle, SeasonalPick as DBSeasonalPick } from '@/types/database';

/** 文章内容块类型 */
export interface ContentBlock {
  type: 'paragraph' | 'image' | 'heading';
  text?: string;
  image?: string;
  caption?: string;
}

/** 前端文章类型（兼容现有组件） */
export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  image: string;
  readTime: string;
  date: string;
  /** 文章正文内容（详情页使用） */
  content?: ContentBlock[];
}

export interface SeasonalPick {
  id: string;
  name: string;
  desc: string;
  image: string;
}

function mapArticle(row: DBArticle): Article {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    category: row.category,
    image: row.image_url ?? '',
    readTime: row.read_time ?? '',
    date: row.date ?? '',
  };
}

function mapSeasonalPick(row: DBSeasonalPick): SeasonalPick {
  return {
    id: row.id,
    name: row.name,
    desc: row.description ?? '',
    image: row.image_url ?? '',
  };
}

// ==================== 模拟数据 ====================

/** Supabase 存储桶中已有的产品图片 */
const IMG = {
  dahongpao: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/dahongpao.jpg',
  longjing: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/longjing.jpg',
  puer: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/puer.jpg',
  yinzhen: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/yinzhen.jpg',
  jinjunmei: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/jinjunmei.jpg',
  molihua: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/molihua.jpg',
} as const;

const MOCK_ARTICLES: Article[] = [
  {
    id: 'mock-art-1',
    title: '大红袍的千年传奇',
    subtitle: '从武夷山到世界，一片茶叶的史诗之旅',
    category: '茶史',
    image: IMG.dahongpao,
    readTime: '8分钟',
    date: '2024-03-20',
    content: [
      { type: 'heading', text: '九龙窠的母树传说' },
      { type: 'paragraph', text: '在武夷山天心岩九龙窠的悬崖峭壁上，生长着六棵已有三百多年历史的大红袍母树。相传明代有位秀才进京赶考，途经武夷山时突然腹痛不止，恰遇天心寺僧人以茶相赠，饮后病痛全消。' },
      { type: 'image', image: IMG.puer, caption: '武夷山九龙窠崖壁上的母树大红袍' },
      { type: 'paragraph', text: '秀才高中状元后，特意回来感谢，并将红袍披在茶树上，"大红袍"之名由此而来。虽然这只是美丽的传说，但大红袍作为"岩茶之王"的地位，却是实至名归的。' },
      { type: 'heading', text: '岩骨花香的秘密' },
      { type: 'paragraph', text: '大红袍之所以独特，在于武夷山独特的丹霞地貌。茶树生长在岩石缝隙中，根系深入风化的砂砾岩层，吸收了丰富的矿物质。加上山谷中常年云雾缭绕，形成了独一无二的"岩韵"——业内称之为"岩骨花香"。' },
      { type: 'image', image: IMG.jinjunmei, caption: '生长在岩缝中的茶树，形成独特的岩韵' },
      { type: 'paragraph', text: '如今，虽然母树大红袍早已停止采摘并投保一亿元人民币，但通过无性繁殖培育出的大红袍品种，已经遍布整个武夷山茶区，让更多人能够品味这一千年传奇。' },
    ],
  },
  {
    id: 'mock-art-2',
    title: '功夫茶的正确冲泡方法',
    subtitle: '掌握水温、投茶量与出汤时间的黄金比例',
    category: '冲泡',
    image: IMG.longjing,
    readTime: '6分钟',
    date: '2024-03-18',
    content: [
      { type: 'heading', text: '什么是功夫茶？' },
      { type: 'paragraph', text: '功夫茶，又称工夫茶，并非指某一种茶，而是一种讲究冲泡技艺的品饮方式。它起源于宋代，兴盛于明清，尤其在闽南、潮汕一带广为流传。"功夫"二字，意在强调冲泡过程中需要投入的时间与精力。' },
      { type: 'image', image: IMG.dahongpao, caption: '出汤瞬间，茶汤如琥珀般明亮' },
      { type: 'heading', text: '器具准备' },
      { type: 'paragraph', text: '传统功夫茶具包括：盖碗或紫砂壶（150ml左右）、公道杯、品茗杯、茶盘、茶巾、茶夹。现代家庭冲泡，一把盖碗加公道杯即可满足需求。' },
      { type: 'heading', text: '冲泡要点' },
      { type: 'paragraph', text: '水温是关键。乌龙茶和普洱茶建议使用100°C沸水；绿茶则需要降温至80-85°C；红茶和白茶适合90-95°C。投茶量一般为容器的1/3至1/2。第一泡为"洗茶"，快速出汤倒掉，从第二泡开始品饮。' },
      { type: 'image', image: IMG.molihua, caption: '标准的功夫茶席布置' },
      { type: 'paragraph', text: '出汤时间随泡数递增：前三泡约5-10秒，之后每泡延长5秒。好茶可以冲泡7-10次，每一泡都有不同的层次变化，这正是功夫茶的魅力所在。' },
    ],
  },
  {
    id: 'mock-art-3',
    title: '紫砂壶：一把壶的修行',
    subtitle: '从选泥到养壶，紫砂文化的前世今生',
    category: '茶器',
    image: IMG.puer,
    readTime: '10分钟',
    date: '2024-03-15',
    content: [
      { type: 'heading', text: '宜兴的泥土传奇' },
      { type: 'paragraph', text: '江苏宜兴，素有"陶都"之称。这里蕴藏着世界上独一无二的紫砂矿泥，包括紫泥、朱泥、段泥等多个品种。紫砂壶之所以成为茶具之王，正是因为这种特殊的双气孔结构——既能透气又不漏水，泡茶时能充分释放茶叶的香气。' },
      { type: 'image', image: IMG.dahongpao, caption: '宜兴丁蜀镇的紫砂原矿泥料' },
      { type: 'heading', text: '一壶一茶的讲究' },
      { type: 'paragraph', text: '行家常说"一壶侍一茶"。紫砂壶的气孔会吸附茶味，长期使用后壶壁会形成"茶山"，即使空壶注入热水也会有淡淡茶香。因此，用紫砂壶泡茶讲究专壶专用——泡普洱的壶不要混泡绿茶。' },
      { type: 'paragraph', text: '养壶是一门长久的功夫。好的紫砂壶经过数年茶汤浸润，表面会逐渐出现温润的光泽，称为"包浆"。这不是人工打磨的光亮，而是时间与茶汤共同赋予的灵魂印记。' },
      { type: 'image', image: IMG.longjing, caption: '经过多年养护后包浆温润的紫砂壶' },
    ],
  },
  {
    id: 'mock-art-4',
    title: '武夷山：岩骨花香的故乡',
    subtitle: '探秘世界双遗产地的茶园风光',
    category: '产地',
    image: IMG.jinjunmei,
    readTime: '7分钟',
    date: '2024-03-12',
    content: [
      { type: 'heading', text: '三十六峰九十九岩' },
      { type: 'paragraph', text: '武夷山位于福建省西北部，是世界文化与自然双遗产地。这里有三十六峰、九十九岩，丹霞地貌形成的独特地理环境，孕育了举世闻名的武夷岩茶。' },
      { type: 'image', image: IMG.dahongpao, caption: '武夷山丹霞地貌，三十六峰层叠' },
      { type: 'paragraph', text: '武夷岩茶的核心产区称为"三坑两涧"——慧苑坑、牛栏坑、倒水坑、流香涧、悟源涧。这些狭窄的山谷中，阳光经过岩壁反射后变得柔和，加上谷底丰沛的水汽，为茶树生长提供了理想环境。' },
      { type: 'heading', text: '正岩与半岩' },
      { type: 'paragraph', text: '岩茶界有"正岩"和"半岩"之分。正岩茶产自核心景区，茶汤醇厚、岩韵明显；半岩茶产自景区边缘，品质稍逊。而同样的品种，种在核心产区与外围，价格可以相差十倍以上。' },
      { type: 'image', image: IMG.puer, caption: '三坑两涧核心产区的茶园' },
    ],
  },
  {
    id: 'mock-art-5',
    title: '春分时节话饮茶',
    subtitle: '顺应节气，品味当季最适宜的茶',
    category: '节气茶',
    image: IMG.molihua,
    readTime: '5分钟',
    date: '2024-03-20',
    content: [
      { type: 'heading', text: '春分与茶' },
      { type: 'paragraph', text: '春分，是二十四节气中的第四个节气，标志着春天的正式到来。此时昼夜等长，阴阳平衡，正是品茶养生的好时节。古人讲究"不时不食"，饮茶亦然——春分时节，宜饮花茶与新采的绿茶。' },
      { type: 'image', image: IMG.longjing, caption: '春分时节，茶园新芽萌发' },
      { type: 'heading', text: '春分推荐茶饮' },
      { type: 'paragraph', text: '春天肝气旺盛，宜饮花茶疏肝理气。茉莉花茶的香气可以舒缓情绪，玫瑰花茶能活血美颜，桂花乌龙则温胃暖身。如果喜欢清新口感，明前龙井是不二之选——嫩绿的茶芽经过一冬的积蓄，氨基酸含量最高，滋味最为鲜爽。' },
      { type: 'paragraph', text: '冲泡春茶时，水温不宜过高，80°C左右最佳，以免烫伤细嫩的茶芽，影响鲜爽的口感。用玻璃杯冲泡，还能欣赏到茶叶在水中舒展的优美姿态。' },
    ],
  },
  {
    id: 'mock-art-6',
    title: '陆羽与《茶经》',
    subtitle: '茶圣陆羽如何定义了中国茶文化',
    category: '茶人',
    image: IMG.jinjunmei,
    readTime: '9分钟',
    date: '2024-03-08',
    content: [
      { type: 'heading', text: '弃儿到茶圣' },
      { type: 'paragraph', text: '陆羽（733-804），字鸿渐，唐代复州竟陵（今湖北天门）人。他自幼被遗弃于西塔寺，由智积禅师收养。寺院中的茶事活动，成为他与茶结缘的开端。' },
      { type: 'image', image: IMG.puer, caption: '陆羽《茶经》是世界上第一部茶叶专著' },
      { type: 'paragraph', text: '陆羽少年时便展现出非凡的文学天赋，后与文人雅士交游，遍访各地茶山。他花费数十年时间，走遍了大半个中国的产茶区，亲自考察茶树生长环境、采制工艺和品饮方法。' },
      { type: 'heading', text: '三卷《茶经》改变世界' },
      { type: 'paragraph', text: '公元760年前后，陆羽完成了传世巨著《茶经》。全书共三卷十章，从茶之源、茶之具、茶之造、茶之器、茶之煮、茶之饮、茶之事、茶之出、茶之略、茶之图，系统而全面地记录了唐代茶文化。' },
      { type: 'paragraph', text: '《茶经》不仅是一部关于茶的百科全书，更将饮茶从日常行为升华为一种文化艺术。此后，茶道精神——"精行俭德"——成为中华文化的重要组成部分。陆羽也因此被后世尊为"茶圣"。' },
    ],
  },
  {
    id: 'mock-art-7',
    title: '白毫银针的采制与品鉴',
    subtitle: '福鼎白茶之王，一芽一味的极致追求',
    category: '冲泡',
    image: IMG.yinzhen,
    readTime: '6分钟',
    date: '2024-03-05',
    content: [
      { type: 'heading', text: '只取单芽的珍贵' },
      { type: 'paragraph', text: '白毫银针，产自福建福鼎和政和，是白茶中的最高等级。它只取茶树的单芽，每年春季仅有短短十几天的采摘窗口。一斤干茶需要约两万个茶芽，其珍贵可见一斑。' },
      { type: 'image', image: IMG.molihua, caption: '白毫银针的单芽，披满白色绒毛' },
      { type: 'heading', text: '最简约的制作工艺' },
      { type: 'paragraph', text: '白茶的加工是所有茶类中最简约的——只经过萎凋和干燥两道工序。不炒不揉，最大程度保留了茶叶的天然成分。新制的银针毫香明显、味道清甜，而经过数年陈化后，会逐渐转化出枣香和药香。' },
      { type: 'heading', text: '冲泡建议' },
      { type: 'paragraph', text: '冲泡白毫银针，建议使用90°C左右的水温，用盖碗或玻璃杯冲泡。第一泡静置约30秒，后续每泡延长10秒。茶汤浅黄明亮，入口清甜回甘，白毫银针有"三泡有韵、七泡余香"的美誉。' },
    ],
  },
  {
    id: 'mock-art-8',
    title: '宋代点茶：千年前的拉花艺术',
    subtitle: '从《梦华录》说起，揭秘宋人的极致茶美学',
    category: '茶史',
    image: IMG.longjing,
    readTime: '7分钟',
    date: '2024-03-01',
    content: [
      { type: 'heading', text: '一碗茶汤的宇宙' },
      { type: 'paragraph', text: '宋代是中国茶文化的巅峰时期。不同于唐代的煎茶和明代以后的泡茶，宋人独创了"点茶"之法——将茶叶研磨成极细的粉末，注水后用茶筅击拂，打出细腻绵密的泡沫。' },
      { type: 'image', image: IMG.yinzhen, caption: '点茶用的茶筅，竹制分叉，用于击拂茶汤' },
      { type: 'heading', text: '斗茶之风' },
      { type: 'paragraph', text: '宋代盛行"斗茶"，这是一种竞技性的品茶活动。评判标准有二：一看汤色，以纯白为上；二看水痕，茶沫咬盏持久不散者为胜。为了让白色茶沫更加醒目，宋人偏爱黑色的建盏。' },
      { type: 'paragraph', text: '这种在茶汤表面以沫作画的技艺，称为"茶百戏"或"分茶"，与今天咖啡店里的拉花艺术异曲同工——只不过，中国人早在千年前就已将其发展为一门精致的艺术。' },
      { type: 'image', image: IMG.jinjunmei, caption: '宋代建盏，黑釉映衬白色茶沫' },
    ],
  },
];

const MOCK_SEASONAL_PICKS: SeasonalPick[] = [
  {
    id: 'mock-sp-1',
    name: '明前龙井',
    desc: '清明前采制，鲜爽回甘，春天的第一口鲜',
    image: IMG.longjing,
  },
  {
    id: 'mock-sp-2',
    name: '茉莉花茶',
    desc: '窨制七次，花香入骨，春日疏肝理气之选',
    image: IMG.molihua,
  },
  {
    id: 'mock-sp-3',
    name: '安吉白茶',
    desc: '氨基酸含量极高，口感鲜爽如兰',
    image: IMG.yinzhen,
  },
];

// ==================== Store ====================

interface ArticleState {
  articles: Article[];
  seasonalPicks: SeasonalPick[];
  loading: boolean;

  fetchArticles: () => Promise<void>;
  fetchSeasonalPicks: () => Promise<void>;
}

export const useArticleStore = create<ArticleState>()((set) => ({
  // 初始值直接使用模拟数据，确保页面立即有内容
  articles: MOCK_ARTICLES,
  seasonalPicks: MOCK_SEASONAL_PICKS,
  loading: false,

  fetchArticles: async () => {
    try {
      set({ loading: true });
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const articles = (data ?? []).map(mapArticle);
      // 仅当 Supabase 有含图片的有效文章时才替换模拟数据
      if (articles.length > 0 && articles[0].image) {
        set({ articles, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err) {
      console.warn('[articleStore] fetchArticles 失败，保持模拟数据:', err);
      set({ loading: false });
    }
  },

  fetchSeasonalPicks: async () => {
    try {
      const { data, error } = await supabase
        .from('seasonal_picks')
        .select('*')
        .order('created_at');

      if (error) throw error;
      const picks = (data ?? []).map(mapSeasonalPick);
      if (picks.length > 0 && picks[0].image) {
        set({ seasonalPicks: picks });
      }
    } catch (err) {
      console.warn('[articleStore] fetchSeasonalPicks 失败，保持模拟数据:', err);
    }
  },
}));
