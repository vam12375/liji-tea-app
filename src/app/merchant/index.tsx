import { Redirect } from "expo-router";

// 直接进入 /merchant 时，重定向到订单列表（履约优先级最高）。
export default function MerchantIndex() {
  return <Redirect href={"/merchant/orders" as never} />;
}
