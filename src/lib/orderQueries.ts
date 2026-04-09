import { parseOrder, parseOrderList } from "@/lib/orderMappers";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/types/database";

/** 每页加载的订单数量。 */
export const ORDER_PAGE_SIZE = 20;

/**订单列表页仅需商品摘要，因此只联表订单项与商品。 */
export const ORDER_LIST_SELECT = "*, order_items(*, product:products(*))";
/** 订单详情页额外需要地址信息，因此补充 addresses 联表。 */
export const ORDER_DETAIL_SELECT =
  "*, order_items(*, product:products(*)), address:addresses(*)";

/** 分页查询订单列表的输入参数。 */
export interface FetchOrdersPageParams {
  userId: string;
  page: number;
  pageSize?: number;
}

/** 分页查询结果统一返回列表、页码与是否还有下一页。 */
export interface FetchOrdersPageResult {
  orders: Order[];
  hasMore: boolean;
  page: number;
}

/**拉取指定页的订单列表，并在查询层就完成数据解析与分页判断。 */
export async function fetchOrdersPage({
  userId,
  page,
  pageSize = ORDER_PAGE_SIZE,
}: FetchOrdersPageParams): Promise<FetchOrdersPageResult> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_LIST_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message || "拉取订单列表失败。");
  }

  const orders = parseOrderList(data);

  return {
    orders,
    hasMore: orders.length >= pageSize,
    page,
  };
}

/** 拉取单个订单详情，返回 `null`表示数据结构不合法或无可用结果。 */
export async function fetchOrderDetail(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_DETAIL_SELECT)
    .eq("id", orderId)
    .single();

  if (error) {
    throw new Error(error.message || "拉取订单详情失败。");
  }

  return parseOrder(data);
}
