// 轻量入口：在不启动真实集成环境的情况下，把必须执行的集成/回放测试方案打印到终端。
const fs = require("node:fs");
const path = require("node:path");

// 使用相对工作目录解析，保证 Windows / CI 环境都能从仓库根目录稳定读取文档。
const planPath = path.resolve("docs/testing-integration-replay-plan.md");

if (!fs.existsSync(planPath)) {
  console.error(`未找到集成/回放测试方案：${planPath}`);
  process.exit(1);
}

console.log(fs.readFileSync(planPath, "utf8"));
