import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/types/database';
import { useUserStore } from '@/stores/userStore';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;

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
  /** 实时回调：更新订单状态 */
  updateOrder: (updated: Order) => void;
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  orders: [],
  currentOrder: null,
  loading: false,

  createOrder: async (params) => {
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
  },

  fetchOrders: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) return;

    set({ loading: true });
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, product:products(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    set({ orders: (data as Order[]) ?? [], loading: false });
  },

  fetchOrderById: async (id) => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, product:products(*)), address:addresses(*)')
      .eq('id', id)
      .single();

    if (data) set({ currentOrder: data as Order });
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
