declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { claimCouponForUser } from "../_shared/coupon.ts";
import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import { getUserFromRequest } from "../_shared/supabase.ts";

interface ClaimCouponRequestBody {
  couponId?: string;
  code?: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse(req, "仅支持 POST 请求。", 405, "method_not_allowed");
  }

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return errorResponse(req, "未登录或登录状态已失效。", 401, "unauthorized");
    }

    const body = (await req.json().catch(() => null)) as ClaimCouponRequestBody | null;
    const couponId = typeof body?.couponId === "string" ? body.couponId.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";

    if (!couponId && !code) {
      return errorResponse(req, "请选择优惠券或输入兑换码。", 400, "missing_coupon_input");
    }

    const result = await claimCouponForUser({
      userId: user.id,
      couponId: couponId || undefined,
      code: code || undefined,
    });

    if (result.error || !result.data || !result.data.coupon) {
      return errorResponse(req, 
        result.error ?? "领取优惠券失败。",
        422,
        "claim_coupon_failed",
      );
    }

    return jsonResponse(req, {
      userCouponId: result.data.id,
      couponId: result.data.coupon.id,
      status: result.data.status,
      claimedAt: result.data.claimed_at,
      coupon: {
        id: result.data.coupon.id,
        title: result.data.coupon.title,
        description: result.data.coupon.description,
        code: result.data.coupon.code,
        discountType: result.data.coupon.discount_type,
        discountValue: Number(result.data.coupon.discount_value ?? 0),
        minSpend: Number(result.data.coupon.min_spend ?? 0),
        maxDiscount:
          result.data.coupon.max_discount === null
            ? null
            : Number(result.data.coupon.max_discount),
        endsAt: result.data.coupon.ends_at,
      },
    });
  } catch (error) {
    return errorResponse(req, 
      error instanceof Error ? error.message : "领取优惠券失败。",
      500,
      "internal_error",
    );
  }
});
