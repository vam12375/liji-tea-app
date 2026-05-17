# CI/CD 配置与分支保护指南

本文档说明项目 CI/CD 流水线的完整配置，以及 GitHub 分支保护规则的推荐设置。

---

## 一、流水线总览

```text
┌─────────────────────────────────────────────────────────────────┐
│                        PR 阶段（质量门禁）                        │
│                                                                 │
│  check.yml          lint + typecheck:all + test                 │
│  check.yml          gitleaks secret 扫描 + npm audit            │
│  migrations.yml     supabase db push --dry-run（仅 migration 变更）│
│  eas-build.yml      打 build-apk label → 出 APK（按需）          │
│                                                                 │
│  ↓ 全部通过 + Code Review → 允许合并                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     merge 到 master（自动部署）                    │
│                                                                 │
│  deploy-functions.yml   部署变更的 Edge Functions → staging       │
│  migrations.yml         supabase db push → staging              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     打 Release Tag（生产部署）                     │
│                                                                 │
│  deploy-functions.yml   部署全部 Edge Functions → production      │
│  eas-build.yml          手动触发 production profile 构建          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、Workflow 文件说明

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `.github/workflows/check.yml` | PR → master, push → master | lint + typecheck + test + secret 扫描 + 依赖审计 |
| `.github/workflows/deploy-functions.yml` | push → master (functions 变更), release | 自动部署 Edge Functions |
| `.github/workflows/migrations.yml` | PR (migrations 变更), push → master | migration dry-run 校验 + staging 推送 |
| `.github/workflows/eas-build.yml` | PR label `build-apk`, workflow_dispatch | 按需触发 EAS 构建 |
| `.github/dependabot.yml` | 每周一 03:00 HKT | 自动检测 npm / GitHub Actions 依赖更新 |

---

## 三、需要配置的 Secrets

在 GitHub 仓库 Settings → Secrets and variables → Actions 中配置：

| Secret 名称 | 用途 | 必需 |
|-------------|------|------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI 认证 token | 是（部署 functions / migrations） |
| `SUPABASE_STAGING_PROJECT_REF` | Staging 项目 ref ID | 是 |
| `SUPABASE_PRODUCTION_PROJECT_REF` | Production 项目 ref ID | 是（生产部署） |
| `EXPO_TOKEN` | Expo / EAS 认证 token | 是（EAS Build） |

### 获取方式

- **SUPABASE_ACCESS_TOKEN**：[Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens)
- **SUPABASE_*_PROJECT_REF**：项目 Settings → General → Reference ID
- **EXPO_TOKEN**：[Expo Access Tokens](https://expo.dev/accounts/[your-account]/settings/access-tokens)

---

## 四、GitHub Environments 配置

建议创建 `production` environment：

1. Settings → Environments → New environment → `production`
2. 勾选 **Required reviewers**，添加至少 1 名审批人
3. 可选：限制部署分支为 `master` 或 tag 模式 `v*`

这样 `deploy-functions.yml` 的 production job 会等待人工审批后才执行。

---

## 五、分支保护规则（推荐配置）

在 Settings → Branches → Add branch protection rule 中配置：

### 规则：`master`

| 设置项 | 推荐值 | 说明 |
|--------|--------|------|
| Require a pull request before merging | ✅ | 禁止直接 push master |
| Require approvals | 1 | 至少 1 人 review |
| Dismiss stale pull request approvals | ✅ | 新 push 后旧 approval 失效 |
| Require status checks to pass | ✅ | 必须通过 CI |
| Status checks that are required | `lint + typecheck + tests`, `security scan` | 两个 job 都必须通过 |
| Require branches to be up to date | ✅ | 合并前必须 rebase 到最新 master |
| Require conversation resolution | ✅ | Review 评论必须全部 resolved |
| Do not allow bypassing | ✅ | 管理员也不能跳过 |

### 可选增强

| 设置项 | 说明 |
|--------|------|
| Require signed commits | 强制 GPG 签名（团队有条件时开启） |
| Require linear history | 强制 rebase，禁止 merge commit |
| Restrict who can push to matching branches | 限制只有 CI bot 能直接推送 |

---

## 六、本地开发工作流

```bash
# 1. 从 master 拉新分支
git checkout -b feat/my-feature

# 2. 开发完成后本地自检
npm run check

# 3. 推送并创建 PR
git push -u origin feat/my-feature
gh pr create --title "feat: 我的功能" --body "描述"

# 4. 如果需要测试 APK，给 PR 打 label
gh pr edit --add-label "build-apk"

# 5. CI 通过 + Review 通过 → Squash merge
```

---

## 七、Dependabot 说明

配置文件：`.github/dependabot.yml`

- 每周一 03:00 (HKT) 自动检查依赖更新
- Expo 相关依赖会被分组到一个 PR
- React Native 相关依赖会被分组到一个 PR
- 开发依赖会被分组到一个 PR
- 同时最多打开 5 个 npm PR + 3 个 Actions PR

### 处理 Dependabot PR

1. 等 CI 通过
2. 本地 `npm install` 验证无破坏性变更
3. 对于 Expo / React Native 大版本升级，建议先在分支上跑一次 EAS Build 验证

---

## 八、生产部署检查清单

发布新版本前确认：

- [ ] master 上所有 CI 绿色
- [ ] staging 环境已验证核心链路（支付、登录、订单）
- [ ] migrations 已推送到 staging 并验证
- [ ] Edge Functions 已部署到 staging 并验证
- [ ] 创建 Release tag（如 `v4.1.0`）
- [ ] 等待 production environment 审批
- [ ] 确认 production 部署完成
- [ ] 手动触发 `eas-build` workflow（production profile）
- [ ] 验证 production APK / AAB
