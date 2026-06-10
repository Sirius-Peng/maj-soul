# Tasks
- [x] Task 1: 工程骨架与运行方式
  - [x] 创建桌面应用工程骨架（内置浏览器可加载雀魂）
  - [x] 提供一键安装/启动脚本（开发者模式）
  - [x] 提供基础 CI/本地测试命令（至少能跑通单元测试框架）

- [x] Task 2: 画面采集与会话管理
  - [x] 定义会话目录结构与命名规则（按时间戳 + 平台）
  - [x] 实现“对局开始/结束”检测（先基于可见 UI 文本/图标锚点）
  - [x] 实现帧采集与关键帧判定（基于 ROI 变化阈值）
  - [x] 实现对局类型识别（三麻/四麻）

- [x] Task 3: 数据模型、数据库与导出
  - [x] 定义 SQLite schema（会话、局、关键帧、状态快照、识别结果、错误）
  - [x] 定义 `session.json` 数据结构（可由数据库记录重建）
  - [x] 实现数据库写入策略（增量写入 + 会话结束落盘一致性校验）
  - [x] 实现 JSON 导出（从数据库汇总导出为 `session.json`）
  - [x] 实现可选 CSV 导出（至少导出关键帧级别的扁平视图）

- [x] Task 4: 视觉识别 MVP（模板匹配优先）
  - [x] 建立牌面模板资源与规范化输入（截图缩放、裁剪 ROI、色彩空间）
  - [x] 识别自家手牌（0–14 张）
  - [x] 识别宝牌指示牌（0–N 张）
  - [x] 识别四家河（每家 0–24 张，遮挡用 unknown）
  - [x] 识别剩余牌堆数（可选；置信度不足输出 null + reason）

- [x] Task 5: 自动安装与测试验证
  - [x] 提供依赖自动安装流程（Node 依赖 + WASM/浏览器资源；Windows/macOS 可运行）
  - [x] 添加基准测试用例（固定截图集）
  - [x] 添加测试断言与报告输出（识别结果 vs 预期）
  - [x] 新增在线页面自动化冒烟测试（打开雀魂页面并采集截图跑识别）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2
- Task 5 depends on Task 1, Task 3, Task 4

# Follow-ups (from checklist validation)
- [x] Smoke：确保 `npm run smoke` 可在首次安装后直接运行（改为 Electron offscreen capture，不依赖 Playwright）

- [x] SQLite：补齐“按时间范围查询会话/关键帧”的读取接口或脚本

- [x] 会话录制端到端验证：补充可自动化的集成测试或可控的“强制开始/结束”开关

- [x] Windows 启动验证：补充 Windows 启动验证步骤与常见问题排查
  - 已在 README 补充：ExecutionPolicy、Node.js 版本确认、运行 `scripts/dev.ps1`、常见报错处理
