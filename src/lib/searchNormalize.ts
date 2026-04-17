// 搜索关键词归一化：把用户输入扩展成多个可匹配的候选词。
// 拼音走前端小词典，避免引入 200KB+ 的 pinyin-pro；命中不到就保持原词，交给 ilike 兜底。

// 常见茶名、产地、茶类的拼音映射：全小写、无声调，覆盖当前商品目录的主要 SKU。
// 新增条目时保持"拼音 → 规范中文名"一对一，同义词请放到 TEA_SYNONYMS。
export const TEA_PINYIN_MAP: Record<string, string> = {
  longjing: "龙井",
  xihulongjing: "西湖龙井",
  biluochun: "碧螺春",
  maofeng: "毛峰",
  huangshanmaofeng: "黄山毛峰",
  liuan: "六安瓜片",
  guapian: "六安瓜片",
  baihaoyinzhen: "白毫银针",
  yinzhen: "白毫银针",
  baimudan: "白牡丹",
  shoumei: "寿眉",
  tieguanyin: "铁观音",
  dahongpao: "大红袍",
  rougui: "肉桂",
  shuixian: "水仙",
  fenghuangdancong: "凤凰单丛",
  dancong: "凤凰单丛",
  jinjunmei: "金骏眉",
  zhengshan: "正山小种",
  zhengshanxiaozhong: "正山小种",
  dianhong: "滇红",
  qihong: "祁红",
  qimen: "祁门红茶",
  puer: "普洱",
  pueru: "普洱",
  puersheng: "普洱生茶",
  puershu: "普洱熟茶",
  fuzhuan: "茯砖",
  liupaocha: "六堡茶",
  molihua: "茉莉花茶",
  molihuacha: "茉莉花茶",
  juhua: "菊花茶",
  meiguihua: "玫瑰花茶",
  // 茶类
  yancha: "岩茶",
  lvcha: "绿茶",
  baicha: "白茶",
  hongcha: "红茶",
  wulong: "乌龙",
  wulongcha: "乌龙",
  heicha: "黑茶",
  huacha: "花茶",
  // 茶具 / 场景
  gaiwan: "盖碗",
  zishahu: "紫砂壶",
  chaju: "茶具",
  songli: "送礼",
  mingqian: "明前",
};

// 中文同义词 / 别名映射：key 为规范名，value 为一组可接受的别名。
// 主要用于地理别称、品牌别称、俗称。
export const TEA_SYNONYMS: Record<string, readonly string[]> = {
  龙井: ["西湖龙井", "狮峰龙井", "梅坞龙井"],
  大红袍: ["武夷岩茶", "武夷大红袍"],
  铁观音: ["安溪铁观音"],
  碧螺春: ["洞庭碧螺春"],
  普洱: ["普洱茶"],
  白毫银针: ["银针", "福鼎银针"],
  金骏眉: ["骏眉"],
  祁门红茶: ["祁红"],
  正山小种: ["小种", "正山"],
  凤凰单丛: ["单丛", "凤凰单枞"],
  黄山毛峰: ["毛峰"],
  茉莉花茶: ["茉莉花", "香片"],
};

// 纯 ASCII 判断：用来决定一个 token 是否应该走拼音映射而不是同义词。
function isAsciiOnly(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 127) {
      return false;
    }
  }
  return true;
}

// 拆词：空格 / 中文逗号 / 英文逗号作为分隔符；去掉空片段后全部转小写返回原 case 对照版本。
export function tokenize(query: string): string[] {
  if (!query) {
    return [];
  }

  return query
    .split(/[\s,，]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

// 把单个 token 展开为一组候选（含自身）。
// - ASCII 全小写后尝试命中拼音 → 补对应的中文名。
// - 中文走同义词 → 补所有别名。
// - 命中不到就只返回自身，走常规 ilike 兜底。
function expandSingleTerm(token: string): string[] {
  const result = new Set<string>([token]);

  if (isAsciiOnly(token)) {
    const mapped = TEA_PINYIN_MAP[token.toLowerCase()];
    if (mapped) {
      result.add(mapped);
    }
    return [...result];
  }

  // 中文：既要查正名 → 别名，也要反查"别名 → 正名"。
  const aliasList = TEA_SYNONYMS[token];
  if (aliasList) {
    for (const alias of aliasList) {
      result.add(alias);
    }
  }

  for (const [canonical, aliases] of Object.entries(TEA_SYNONYMS)) {
    if (aliases.includes(token)) {
      result.add(canonical);
    }
  }

  return [...result];
}

// 把用户输入的整条 query 归一化成一组可用于模糊匹配的候选词。
export function expandQueryTerms(query: string): string[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [];
  }

  const result = new Set<string>();
  for (const token of tokens) {
    for (const candidate of expandSingleTerm(token)) {
      result.add(candidate);
    }
  }

  return [...result];
}
