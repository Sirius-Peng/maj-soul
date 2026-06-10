# Release Packaging Design

**Date:** 2026-06-10
**Status:** Approved in chat, pending written-spec review

## Goal

为当前雀魂桌面辅助项目补齐首个未签名预发布能力，在一个新的发布分支中完成：

- macOS 安装与分发产物
- Windows 安装与分发产物
- GitHub Actions 自动构建与上传 GitHub Releases

本次目标是稳定地产出可下载的预发布资产，而不是一次性完成正式签名、Apple notarization 或 Windows 代码签名。

## Constraints

- 代码基线采用新的发布分支，而不是直接修改现有 PR 分支或 `main`
- 发布形态选择“未签名预发布”
- 当前仓库没有现成的 Electron 打包配置
- 当前仓库没有现成的 Release workflow
- 当前仓库没有正式应用图标资源；本次允许使用默认 Electron 图标完成预发布
- 现有自动化验证必须继续保留，至少包括 `npm test`

## Recommended Approach

采用 GitHub Actions 原生双平台构建，而不是在当前 macOS 开发机上做跨平台本地打包。

原因：

- macOS 与 Windows 分别使用各自原生 runner，构建稳定性高于本地交叉编译
- 一旦工作流落地，后续可通过打 tag 重复发布
- 可以把本次“发布能力”沉淀为仓库级基础设施，而不是一次性手工操作

## Alternatives Considered

### Option A: Local packaging on the current Mac

优点：

- 变更少
- 可以更快看到本地 macOS 产物

缺点：

- Windows 安装包交叉构建依赖额外环境，稳定性差
- 不适合作为后续长期发版方案

### Option B: GitHub Actions native packaging for each platform

优点：

- `macos-latest` 负责 macOS，`windows-latest` 负责 Windows
- 产物与流程可复用
- 更接近正式工程发布流程

缺点：

- 需要补齐打包配置和工作流

本设计选择该方案。

### Option C: Single-platform packaging plus manual upload

优点：

- 交付最快

缺点：

- 无法满足本次“同时提供 macOS 和 Windows 产物”的目标

## Release Branch Strategy

在当前工作基础上新建一个发布分支，用于承载以下变更：

- Electron 打包配置
- GitHub Actions release workflow
- README 下载与安装说明
- 与发布相关的脚本和元数据

该分支完成验证后推送到 GitHub。Release 构建与上传基于该分支上的 tag 进行。

## Artifact Matrix

### macOS

- `dmg`
- `zip`

说明：

- `dmg` 适合作为常规分发安装入口
- `zip` 适合作为备用分发资产，也更便于自动化下载和排错

### Windows

- NSIS 安装包 `.exe`
- 便携式压缩产物

说明：

- NSIS 安装包用于常规安装
- 便携产物用于规避安装器环境问题，并为用户提供兜底下载方式

## Versioning and Release Shape

- 当前项目版本为 `0.1.0`
- 首个 release 默认采用 tag `v0.1.0`
- 本次 GitHub Release 标记为 `pre-release`
- `package.json` 版本需要与 release tag 保持一致

如果后续用户要求改版本号，可以在实现前调整，但设计默认以 `v0.1.0` 为基线。

## Build System Design

### Package Metadata

在 `package.json` 中补充：

- 构建命令
- 发布命令
- Electron Builder 依赖与配置入口

需要保留当前已有的：

- `npm test`
- `npm run smoke:launcher`

### Electron Builder Configuration

新增独立配置文件，避免把大量发布配置塞进 `package.json`。

配置中至少包含：

- `appId`
- `productName`
- `artifactName`
- 平台目标
- 打包文件白名单
- 输出目录

本次不接入：

- 代码签名
- notarization
- 自动更新

## GitHub Actions Release Workflow

新增专用 release workflow，采用以下设计：

- 触发方式：
  - 推送 tag 时自动触发
  - 允许手动触发作为兜底
- Job 结构：
  - `macos-latest` 构建 macOS 产物
  - `windows-latest` 构建 Windows 产物
- 每个平台 job：
  - checkout
  - setup Node.js 22
  - `npm ci`
  - `npm test`
  - 执行平台对应打包命令
  - 上传 artifact
- 汇总发布：
  - 创建或更新 GitHub Release
  - 上传所有平台资产
  - 将 Release 标记为 `pre-release`

## Validation Strategy

### Local validation before push

在当前 macOS 开发环境先做以下验证：

- `npm test`
- 本地 macOS 打包命令至少成功一次

这一步的目标是尽早发现打包配置问题，而不是在 workflow 中盲调。

### CI validation in GitHub Actions

Windows 产物不依赖本机交叉构建，而是以 GitHub Actions 的 `windows-latest` 结果为准。

工作流成功标准：

- 双平台 job 均成功
- GitHub Release 已创建
- Release 页面中可见所有预期资产

## README and User Communication

README 需要补充：

- 下载位置
- macOS 未签名提示的处理方式
- Windows 未知发布者提示的处理方式
- 当前 Release 为预发布的说明

Release Notes 需要明确：

- 本次为 unsigned pre-release
- macOS 首次运行可能需要在系统设置中放行
- Windows 可能出现 SmartScreen 提示

## Out of Scope

本次明确不包含：

- Apple Developer 证书接入
- macOS notarization
- Windows Authenticode 签名
- 自动更新服务
- 品牌化图标与安装界面定制
- 商店分发

## Risks and Mitigations

### Risk: Missing icons

风险：

- 发布产物默认使用 Electron 图标，观感一般

缓解：

- 本次允许默认图标，不阻塞发版
- 后续单独补资源资产

### Risk: Unsigned app warnings

风险：

- macOS Gatekeeper 与 Windows SmartScreen 会提示未知开发者

缓解：

- 在 README 和 Release Notes 中明确说明
- 将本次发布标为 `pre-release`

### Risk: Platform-specific packaging failure

风险：

- 某个平台 runner 可能因配置问题构建失败

缓解：

- 本地先完成 macOS 打包验证
- Windows 使用原生 runner，避免本地交叉构建复杂性
- 将安装器与压缩包同时作为发布目标，保留兜底分发方式

## Success Criteria

以下全部满足即视为本次设计达成目标：

- 新发布分支中已具备 Electron 打包配置
- 能从该分支生成 macOS 与 Windows 产物
- GitHub Actions 能自动创建或更新 GitHub Release
- Release 页面包含 macOS 和 Windows 资产
- README 与 Release Notes 已说明未签名预发布限制
