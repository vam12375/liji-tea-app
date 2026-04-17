import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { Colors } from "@/constants/Colors";
import { TEA_CATEGORIES, type TeaCategory } from "@/data/products";
import type {
  SearchPriceBand,
  SearchSortMode,
} from "@/hooks/useSearchResults";

interface SearchFiltersProps {
  category: TeaCategory;
  priceBand: SearchPriceBand;
  sortMode: SearchSortMode;
  onCategoryChange: (next: TeaCategory) => void;
  onPriceBandChange: (next: SearchPriceBand) => void;
  onSortModeChange: (next: SearchSortMode) => void;
}

const PRICE_BAND_LABELS: Record<SearchPriceBand, string> = {
  all: "价格不限",
  "0-100": "¥0-100",
  "100-300": "¥100-300",
  "300+": "¥300+",
};

const SORT_LABELS: Record<SearchSortMode, string> = {
  relevance: "默认排序",
  priceAsc: "价格升序",
  priceDesc: "价格降序",
  newest: "最新上架",
};

// 搜索结果筛选条：品类胶囊 + 价格 / 排序两个下拉按钮。
// 所有状态走外部受控 props，本组件不持有业务 state。
export default function SearchFilters({
  category,
  priceBand,
  sortMode,
  onCategoryChange,
  onPriceBandChange,
  onSortModeChange,
}: SearchFiltersProps) {
  const [openMenu, setOpenMenu] = useState<"price" | "sort" | null>(null);

  const priceBandOptions = useMemo(
    () => Object.entries(PRICE_BAND_LABELS) as [SearchPriceBand, string][],
    [],
  );
  const sortModeOptions = useMemo(
    () => Object.entries(SORT_LABELS) as [SearchSortMode, string][],
    [],
  );

  return (
    <View className="gap-3">
      {/* 品类胶囊：水平滚动条直接复用现有 TEA_CATEGORIES，避免再造一份。 */}
      <View className="flex-row flex-wrap gap-2">
        {TEA_CATEGORIES.map((cat) => {
          const active = cat === category;
          return (
            <Pressable
              key={cat}
              onPress={() => onCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-full ${
                active ? "bg-primary-container" : "border border-outline-variant"
              }`}
            >
              <Text
                className={`text-xs ${
                  active
                    ? "text-on-surface font-medium"
                    : "text-on-surface-variant"
                }`}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 价格 + 排序：并排两个点击展开的小菜单，避免额外引入底部 Sheet 依赖。 */}
      <View className="flex-row gap-2">
        <FilterToggle
          label={PRICE_BAND_LABELS[priceBand]}
          active={openMenu === "price"}
          onPress={() =>
            setOpenMenu((current) => (current === "price" ? null : "price"))
          }
        />
        <FilterToggle
          label={SORT_LABELS[sortMode]}
          active={openMenu === "sort"}
          onPress={() =>
            setOpenMenu((current) => (current === "sort" ? null : "sort"))
          }
        />
      </View>

      {openMenu === "price" ? (
        <OptionList
          options={priceBandOptions}
          selected={priceBand}
          onSelect={(value) => {
            onPriceBandChange(value);
            setOpenMenu(null);
          }}
        />
      ) : null}

      {openMenu === "sort" ? (
        <OptionList
          options={sortModeOptions}
          selected={sortMode}
          onSelect={(value) => {
            onSortModeChange(value);
            setOpenMenu(null);
          }}
        />
      ) : null}
    </View>
  );
}

interface FilterToggleProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function FilterToggle({ label, active, onPress }: FilterToggleProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full ${
        active ? "bg-secondary-container" : "border border-outline-variant"
      }`}
    >
      <Text
        className={`text-xs ${
          active
            ? "text-on-surface font-medium"
            : "text-on-surface-variant"
        }`}
      >
        {label}
      </Text>
      <MaterialIcons
        name={active ? "expand-less" : "expand-more"}
        size={16}
        color={active ? Colors.onSurface : Colors.outline}
      />
    </Pressable>
  );
}

interface OptionListProps<T extends string> {
  options: [T, string][];
  selected: T;
  onSelect: (value: T) => void;
}

// 下拉选项列表：单选 + 选中高亮。保持简单，不做键盘 / 手势处理。
function OptionList<T extends string>({
  options,
  selected,
  onSelect,
}: OptionListProps<T>) {
  return (
    <View className="bg-surface-container-low rounded-xl p-2 gap-1">
      {options.map(([value, label]) => {
        const active = value === selected;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            className={`flex-row items-center justify-between px-3 py-2 rounded-lg ${
              active ? "bg-primary-container" : ""
            }`}
          >
            <Text
              className={`text-sm ${
                active
                  ? "text-on-surface font-medium"
                  : "text-on-surface"
              }`}
            >
              {label}
            </Text>
            {active ? (
              <MaterialIcons
                name="check"
                size={18}
                color={Colors.primary}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
