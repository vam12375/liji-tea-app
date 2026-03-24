import { createClient } from "jsr:@supabase/supabase-js@2";

/** 读取必填环境变量，缺失时直接中断函数执行。 */
export function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }

  return value;
}

/** 使用 service role 创建服务端客户端，用于订单与支付流水写操作。 */
export function createServiceClient() {
  return createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/** 从 Authorization 中解析当前用户，供需登录的函数使用。 */
export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return null;
  }

  const client = createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_ANON_KEY"),
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}
