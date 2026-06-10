# 商业化工程治理强化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前项目整理成更接近商业化工程交付的仓库形态，补齐 README、仓库元数据、基础 CI、验证脚本收口，并结合 Copilot review 做一轮工程性修正。

**Architecture:** 以“工程治理优先”为边界，尽量不大改核心雀魂采集与建议链路，只收口项目入口、文档、脚本和质量门禁。对新增代码保持最小化，优先通过现有测试体系和启动级 smoke 验证现有行为不回退。

**Tech Stack:** Electron、Node.js、原生 `node --test`、GitHub Actions、GitHub CLI Copilot

---

### Task 1: 收口项目元数据与验证脚本

**Files:**
- Modify: `/Users/nh_y/Desktop/maj-soul/package.json`
- Test: `/Users/nh_y/Desktop/maj-soul/package.json`

- [ ] **Step 1: 明确要暴露的工程元数据与脚本**

确认需要补充的字段和脚本：

```json
{
  "description": "雀魂桌面辅助工具，提供启动器、事实采集、建议悬浮窗与会话导出",
  "repository": {
    "type": "git",
    "url": "https://github.com/Sirius-Peng/maj-soul.git"
  },
  "bugs": {
    "url": "https://github.com/Sirius-Peng/maj-soul/issues"
  },
  "homepage": "https://github.com/Sirius-Peng/maj-soul",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "check": "npm test",
    "ci:check": "npm test"
  }
}
```

- [ ] **Step 2: 修改 `package.json`**

把上面的元数据与脚本合并到现有文件，保留已有 `dev/start/bench/smoke/smoke:launcher/test`。

- [ ] **Step 3: 验证脚本可执行**

Run: `npm run check`
Expected: 退出码 `0`，现有测试通过

### Task 2: 补齐基础仓库治理文件

**Files:**
- Create: `/Users/nh_y/Desktop/maj-soul/.editorconfig`
- Create: `/Users/nh_y/Desktop/maj-soul/.github/workflows/ci.yml`

- [ ] **Step 1: 新增 `.editorconfig`**

写入统一编辑器规则：

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 2: 新增 CI 工作流**

创建最小可运行 CI，仅执行依赖安装和 `npm run ci:check`：

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run ci:check
```

- [ ] **Step 3: 自检 YAML 与仓库结构**

Run: `git diff -- .editorconfig .github/workflows/ci.yml`
Expected: 只包含预期新增内容

### Task 3: 重写正式 README

**Files:**
- Modify: `/Users/nh_y/Desktop/maj-soul/README.md`

- [ ] **Step 1: 确定 README 结构**

覆盖这些章节：

```md
# 项目名称
## 项目定位
## 核心能力
## 系统架构
## 快速开始
## 图形化启动器
## DeepSeek 建议能力
## 数据目录与导出
## 开发命令
## 测试与验证
## 常见问题
## 路线图
```

- [ ] **Step 2: 重写 README**

要求：
- 面向公开仓库读者，而不只是当前开发者
- 解释“事实优先，视觉兜底”的架构
- 明确当前边界、风险与未完成项
- 保留 Windows 启动说明与 launcher 使用说明

- [ ] **Step 3: 手动检查 README**

Run: `grep -n "^## " README.md`
Expected: 输出完整章节标题，能覆盖项目介绍、运行、验证、FAQ

### Task 4: 调用 Copilot review 并落地修正

**Files:**
- Modify: `/Users/nh_y/Desktop/maj-soul/docs/devlog.md`
- Modify: `/Users/nh_y/Desktop/maj-soul/[根据 review 结果涉及的文件]`

- [ ] **Step 1: 先检查 GitHub CLI 登录状态**

Run: `gh auth status`
Expected: 若已登录则继续；若未登录则记录阻塞并请求用户完成登录

- [ ] **Step 2: 调用 Copilot review**

推荐命令：

```bash
gh copilot -p "Review the current repository as a production-grade Electron app. Focus on engineering hygiene, documentation, configuration, maintainability, and obvious risks. Return actionable findings only." --allow-tool 'shell(git status)' --allow-tool 'shell(git diff --stat)' --allow-tool 'shell(git ls-files)'
```

- [ ] **Step 3: 落地高价值建议**

仅实现明确、低风险、能提升工程质量的建议，并把处理结果记录到 `docs/devlog.md`。

### Task 5: 回归验证、提交与推送

**Files:**
- Modify: `/Users/nh_y/Desktop/maj-soul/docs/devlog.md`

- [ ] **Step 1: 运行回归验证**

Run: `npm test`
Expected: 全部通过

Run: `npm run smoke:launcher`
Expected: 退出码 `0`

- [ ] **Step 2: 配置远程仓库**

Run: `git remote add origin https://github.com/Sirius-Peng/maj-soul.git`
Expected: `git remote -v` 显示 `origin`

若已存在，则改为：

```bash
git remote set-url origin https://github.com/Sirius-Peng/maj-soul.git
```

- [ ] **Step 3: 提交本地 Git**

```bash
git add -A
git commit -m "chore: harden repository for commercial engineering"
```

- [ ] **Step 4: 推送到 GitHub**

Run: `git push -u origin main`
Expected: 推送成功

