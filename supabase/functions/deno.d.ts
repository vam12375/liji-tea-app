// Deno 运行时全局类型声明（用于 Supabase Edge Functions）
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

// Supabase 客户端类型（从 JSR 导入）
declare module "jsr:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}
