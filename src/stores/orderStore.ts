import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/types/database';
import { useUserStore } from '@/stores/userStore';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  /** 订单详情页专用加载态，避免与订单列表 loading 混用。 */
  currentOrderLoading: boolean;

  createOrder: (params: {
    items: { productId: string; quantity: number; unitPrice: number }[];
    addressId: string;
    total: number;
    deliveryType: string;
    paymentMethod: string;
    notes?: string;
    giftWrap: boolean;
  }) => Promise<{ orderId: string | null; error: string | null }>;

  fetchOrders: () => Promise<void>;
  fetchOrderById: (id: string) => Promise<void>;
  /** 更新订单状态（如 pending → paid） */
  updateOrderStatus: (orderId: string, status: string) => Promise<{ error: string | null }>;
  /** 实时回调：更新订单状态 */
  updateOrder: (updated: Order) => void;
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  orders: [],
  currentOrder: null,
  loading: false,
  currentOrderLoading: false,

  createOrder: async (params) => {
    try {
      const userId = useUserStore.getState().session?.user?.id;
      if (!userId) return { orderId: null, error: '未登录' };

      // 创建订单主记录
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          address_id: params.addressId,
          total: params.total,
          delivery_type: params.deliveryType,
          payment_method: params.paymentMethod,
          notes: params.notes ?? null,
          gift_wrap: params.giftWrap,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError || !order) {
        return { orderId: null, error: orderError?.message ?? '创建订单失败' };
      }

      // 创建订单明细
      const orderItems = params.items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        return { orderId: null, error: itemsError.message };
      }

      return { orderId: order.id, error: null };
    } catch (err: any) {
      console.warn('[orderStore] createOrder 失败:', err);
      return { orderId: null, error: err?.message ?? '创建订单失败' };
    }
  },

  fetchOrders: async () => {
    try {
      const userId = useUserStore.getState().session?.user?.id;
      if (!userId) return;

      set({ loading: true });
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(*))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ orders: (data as Order[]) ?? [], loading: false });
    } catch (err) {
      console.warn('[orderStore] fetchOrders 失败:', err);
      set({ loading: false });
    }
  },

  fetchOrderById: async (id) => {
    try {
      // 进入订单详情页时先清空旧详情，避免从 A 订单切到 B 订单时短暂显示旧数据。
      set({ currentOrder: null, currentOrderLoading: true });

      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(*)), address:addresses(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        set({ currentOrder: data as Order, currentOrderLoading: false });
        return;
      }

      // 兜底分支：理论上 single() 找不到会抛错，这里仍显式回落为空详情状态。
      set({ currentOrder: null, currentOrderLoading: false });
    } catch (err) {
      console.warn('[orderStore] fetchOrderById 失败:', err);
      set({ currentOrder: null, currentOrderLoading: false });
    }
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) return { error: error.message };

      // 同步更新本地状态
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === orderId ? { ...o, status } : o
        ),
        currentOrder:
          state.currentOrder?.id === orderId
            ? { ...state.currentOrder, status }
            : state.currentOrder,
      }));

      return { error: null };
    } catch (err: any) {
      console.warn('[orderStore] updateOrderStatus 失败:', err);
      return { error: err?.message ?? '更新状态失败' };
    }
  },

  updateOrder: (updated) => {
    set((state) => ({
      orders: state.orders.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
      currentOrder: state.currentOrder?.id === updated.id
        ? { ...state.currentOrder, ...updated }
        : state.currentOrder,
    }));
  },
}));
