-- 原子性初始化支付：同时更新订单状态和创建支付流水
-- 用于 alipay-create-order 确保数据一致性

CREATE OR REPLACE FUNCTION atomic_init_payment(
  p_order_id UUID,
  p_user_id UUID,
  p_channel TEXT,
  p_out_trade_no TEXT,
  p_amount NUMERIC,
  p_subject TEXT,
  p_item_count INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_result JSON;
BEGIN
  -- 1. 更新订单支付状态
  UPDATE orders
  SET
    total = p_amount,
    payment_channel = p_channel,
    payment_status = 'paying',
    out_trade_no = p_out_trade_no,
    payment_error_code = NULL,
    payment_error_message = NULL,
    updated_at = v_now
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  -- 2. 插入或更新支付流水（使用 out_trade_no 作为幂等键）
  INSERT INTO payment_transactions (
    order_id,
    user_id,
    channel,
    out_trade_no,
    amount,
    status,
    request_payload,
    notify_verified,
    updated_at
  )
  VALUES (
    p_order_id,
    p_user_id,
    p_channel,
    p_out_trade_no,
    p_amount,
    'paying',
    jsonb_build_object(
      'orderId', p_order_id,
      'amount', p_amount::TEXT,
      'subject', p_subject,
      'itemCount', p_item_count
    ),
    FALSE,
    v_now
  )
  ON CONFLICT (out_trade_no)
  DO UPDATE SET
    amount = EXCLUDED.amount,
    status = EXCLUDED.status,
    request_payload = EXCLUDED.request_payload,
    updated_at = EXCLUDED.updated_at;

  -- 3. 返回成功标识
  v_result := json_build_object(
    'success', TRUE,
    'updated_at', v_now
  );

  RETURN v_result;
END;
$$;

-- 授权给 service_role
GRANT EXECUTE ON FUNCTION atomic_init_payment TO service_role;

COMMENT ON FUNCTION atomic_init_payment IS '原子性初始化支付流程，同时更新订单状态和创建支付流水记录';
