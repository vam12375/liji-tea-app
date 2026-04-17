import { supabase } from "@/lib/supabase";
import {
  invokeSupabaseFunctionStrict,
  SupabaseFunctionError,
} from "@/lib/supabaseFunction";
import type {
  AfterSaleEvidence,
  AfterSaleRequest,
  AfterSaleRequestStatus,
} from "@/types/database";

// 对外保持原有公开 API：纯逻辑实现迁移到 @/lib/afterSaleState，这里只做再导出。
export {
  AFTER_SALE_REASON_OPTIONS,
  canApplyAfterSale,
  getAfterSaleReasonLabel,
  getAfterSaleStatusDescription,
  getAfterSaleStatusLabel,
  isActiveAfterSaleStatus,
} from "@/lib/afterSaleState";

export interface AfterSaleEvidenceView extends AfterSaleEvidence {
  display_url: string | null;
}

export interface AfterSaleRequestView
  extends Omit<AfterSaleRequest, "evidences"> {
  evidences?: AfterSaleEvidenceView[];
}

export interface CreateAfterSaleRequestInput {
  orderId: string;
  reasonCode: string;
  reasonText?: string;
}

export interface CreateAfterSaleRequestResponse {
  requestId: string;
  orderId: string;
  status: AfterSaleRequestStatus;
  requestedAmount: number;
  approvedAmount: number | null;
}

export interface CancelAfterSaleRequestResponse {
  requestId: string;
  orderId: string;
  status: Extract<AfterSaleRequestStatus, "cancelled">;
}

export const AFTER_SALE_SELECT = `
  id,
  order_id,
  user_id,
  request_type,
  scope_type,
  status,
  reason_code,
  reason_text,
  requested_amount,
  approved_amount,
  currency,
  audit_note,
  refund_note,
  snapshot,
  submitted_at,
  reviewed_at,
  refunded_at,
  cancelled_at,
  created_at,
  updated_at,
  evidences:after_sale_evidences(
    id,
    request_id,
    file_url,
    sort_order,
    created_at
  )
`;

type AfterSaleRequestRow = Omit<AfterSaleRequest, "evidences" | "order"> & {
  snapshot: Record<string, unknown> | null;
  evidences?: AfterSaleEvidence[] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNullableNumber(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function isAfterSaleRequestStatus(
  value: unknown,
): value is AfterSaleRequestStatus {
  return (
    value === "submitted" ||
    value === "auto_approved" ||
    value === "pending_review" ||
    value === "approved" ||
    value === "rejected" ||
    value === "refunding" ||
    value === "refunded" ||
    value === "cancelled"
  );
}

function isAfterSaleEvidenceRow(value: unknown): value is AfterSaleEvidence {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.request_id === "string" &&
    typeof value.file_url === "string" &&
    typeof value.sort_order === "number" &&
    typeof value.created_at === "string"
  );
}

function isAfterSaleRequestRow(value: unknown): value is AfterSaleRequestRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.order_id === "string" &&
    typeof value.user_id === "string" &&
    value.request_type === "refund" &&
    value.scope_type === "order" &&
    isAfterSaleRequestStatus(value.status) &&
    typeof value.reason_code === "string" &&
    isNullableString(value.reason_text) &&
    typeof value.requested_amount === "number" &&
    isNullableNumber(value.approved_amount) &&
    typeof value.currency === "string" &&
    isNullableString(value.audit_note) &&
    isNullableString(value.refund_note) &&
    (value.snapshot === null || isRecord(value.snapshot)) &&
    typeof value.submitted_at === "string" &&
    isNullableString(value.reviewed_at) &&
    isNullableString(value.refunded_at) &&
    isNullableString(value.cancelled_at) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    (value.evidences === undefined ||
      value.evidences === null ||
      (Array.isArray(value.evidences) &&
        value.evidences.every(isAfterSaleEvidenceRow)))
  );
}

function normalizeAfterSaleRequestRow(
  row: AfterSaleRequestRow,
): AfterSaleRequest {
  return {
    ...row,
    snapshot: row.snapshot ?? {},
    evidences: row.evidences ?? [],
  };
}

async function resolveEvidenceDisplayUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from("after-sale-evidences")
    .createSignedUrl(filePath, 60 * 60);

  if (error) {
    return null;
  }

  return data?.signedUrl ?? null;
}

async function resolveAfterSaleRequest(
  request: AfterSaleRequest | null,
): Promise<AfterSaleRequestView | null> {
  if (!request) {
    return null;
  }

  const evidences = await Promise.all(
    (request.evidences ?? []).map(async (item) => ({
      ...item,
      display_url: await resolveEvidenceDisplayUrl(item.file_url),
    })),
  );

  return {
    ...request,
    evidences,
  };
}

async function getAuthenticatedUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id ?? null;
  if (!userId) {
    throw new SupabaseFunctionError({
      kind: "auth",
      message: "请先登录后再处理售后。",
      status: 401,
    });
  }

  return userId;
}

export async function fetchAfterSaleRequestById(requestId: string) {
  const { data, error } = await supabase
    .from("after_sale_requests")
    .select(AFTER_SALE_SELECT)
    .eq("id", requestId)
    .single();

  if (error) {
    throw new Error(error.message || "加载售后详情失败");
  }

  if (!isAfterSaleRequestRow(data)) {
    throw new Error("售后详情数据格式不正确");
  }

  return resolveAfterSaleRequest(normalizeAfterSaleRequestRow(data));
}

export async function fetchOrderAfterSaleRequest(orderId: string) {
  const { data, error } = await supabase
    .from("after_sale_requests")
    .select(AFTER_SALE_SELECT)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message || "加载订单售后信息失败");
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return null;
  }

  if (!isAfterSaleRequestRow(row)) {
    throw new Error("订单售后信息数据格式不正确");
  }

  return resolveAfterSaleRequest(normalizeAfterSaleRequestRow(row));
}

export async function createAfterSaleRequest(
  input: CreateAfterSaleRequestInput,
) {
  return invokeSupabaseFunctionStrict<CreateAfterSaleRequestResponse>(
    "create-after-sale-request",
    {
      authMode: "session",
      fallbackMessage: "提交退款申请失败。",
      invalidDataMessage: "服务端未返回有效的售后申请结果。",
      validate: (payload) =>
        Boolean(
          payload &&
            typeof payload.requestId === "string" &&
            typeof payload.orderId === "string" &&
            isAfterSaleRequestStatus(payload.status) &&
            typeof payload.requestedAmount === "number",
        ),
      body: {
        orderId: input.orderId,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText?.trim() || null,
      },
    },
  );
}

export async function cancelAfterSaleRequest(requestId: string) {
  return invokeSupabaseFunctionStrict<CancelAfterSaleRequestResponse>(
    "cancel-after-sale-request",
    {
      authMode: "session",
      fallbackMessage: "撤销售后申请失败。",
      invalidDataMessage: "服务端未返回有效的撤销结果。",
      validate: (payload) =>
        Boolean(
          payload &&
            typeof payload.requestId === "string" &&
            typeof payload.orderId === "string" &&
            payload.status === "cancelled",
        ),
      body: { requestId },
    },
  );
}

export async function uploadAfterSaleEvidence(params: {
  requestId: string;
  base64: string;
  ext?: string;
  sortOrder: number;
}) {
  const userId = await getAuthenticatedUserId();
  const ext = params.ext === "png" ? "png" : "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  const binaryString = atob(params.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  const filePath = `${userId}/${params.requestId}/${Date.now()}-${params.sortOrder}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("after-sale-evidences")
    .upload(filePath, bytes, {
      upsert: false,
      contentType: mimeType,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "上传售后凭证失败");
  }

  const { error: insertError } = await supabase
    .from("after_sale_evidences")
    .insert({
      request_id: params.requestId,
      file_url: filePath,
      sort_order: params.sortOrder,
    });

  if (insertError) {
    await supabase.storage.from("after-sale-evidences").remove([filePath]);
    throw new Error(insertError.message || "保存售后凭证失败");
  }
}
