# DeepSeek 实时建议悬浮窗设计

## 目标

在当前雀魂桌面工具中增加“实时操作建议”能力：当系统识别到“轮到我操作”时，自动调用 DeepSeek v4flash API，基于当前对局事实流与合法动作集合，返回下一步操作建议，并通过独立悬浮窗展示主建议、备选方案和相对概率。

## 设计原则

- 事实优先，视觉兜底：协议事实流负责判断“什么时候该问、能做什么”，视觉识别只作为补充证据。
- 合法动作约束：LLM 只能在本地系统给出的 `legalActions` 中选择，不能编造动作。
- 自动触发：检测到操作机会后自动请求建议，不要求手动点击。
- 只读展示优先：首版悬浮窗只展示建议，不自动点击游戏按钮。
- 结构化输入输出：长期系统提示固定，动态输入为结构化事实快照，模型输出强制为 JSON。

## 借鉴 MahjongCopilot 的方式

MahjongCopilot 的核心价值不在于其具体 bot 模型，而在于它把建议系统拆成稳定的数据管线：

1. 协议事实流还原状态
2. 识别当前操作机会
3. 生成统一的建议对象
4. 展示主建议和 topK 候选

本项目沿用这条主线，但把“本地模型/规则决策”替换成“LLM 决策层”：

- `协议事实 -> DecisionFrame -> DeepSeek -> AdviceResult -> Overlay`

## 功能范围

首版覆盖以下操作类型：

- 出牌
- 吃
- 碰
- 杠
- 立直
- 和牌
- 跳过/取消

不在首版范围内：

- 自动点击执行建议
- 复杂长文本局势分析
- 历史建议回放面板
- 多模型对比

## 核心模块

### 1. Operation Opportunity Detector

职责：

- 消费 `liqi_events`
- 识别当前是否进入“我方可操作回合”
- 输出统一的 `DecisionFrame`

输出字段：

- `turnId`
- `seat`
- `operationType`
- `legalActions`
- `gameSnapshot`
- `recentEvents`
- `uiEvidence`
- `strategyProfile`

### 2. DeepSeek Advice Service

职责：

- 维护长期系统提示
- 把 `DecisionFrame` 转换为 LLM 请求
- 调用 DeepSeek v4flash API
- 校验并规范化模型返回 JSON

输出统一为 `AdviceResult`：

- `turnId`
- `recommendedAction`
- `alternatives[]`
- `summary`
- `modelNotes`
- `latencyMs`

### 3. Advice Coordinator

职责：

- 同一 `turnId` 去重
- 新回合到来时取消旧请求
- 超时控制
- 错误降级
- 把建议结果广播给悬浮窗

### 4. Overlay Window

职责：

- 用独立透明 `BrowserWindow` 展示建议
- 不影响主游戏窗口
- 支持分析中、已更新、失败、数据不足四种状态

## 长期化 Prompt

### 系统提示

长期系统提示要求：

- 你是雀魂实时操作建议助手
- 只能在 `legalActions` 内选择
- 不输出聊天内容，只输出 JSON
- 概率表示相对推荐权重，不是严格胜率
- 当信息不足时必须降低置信度并明确说明
- 每个候选都要提供简短理由与风险

### 动态输入

每次请求传入：

- 局面基本信息（场风、局数、本场、供托、自风）
- 当前手牌、副露、宝牌信息
- 四家河与可见公开信息
- 当前合法动作集合
- 最近关键事件
- 当前策略档（平衡/防守/进攻）

### 结构化输出

输出 JSON 结构：

- `turnId`
- `recommendedAction`
- `alternatives`
- `summary`
- `modelNotes`

其中每个候选包含：

- `type`
- `label`
- `probability`
- `confidence`
- `reason`
- `risk`

## 悬浮窗设计

首版悬浮窗字段：

- 标题：`实时建议`
- 状态：`分析中 / 已更新 / 失败 / 数据不足`
- 主建议：动作、概率、理由、风险
- 备选方案：top 3
- 辅助标签：策略档、数据完整度、响应耗时

展示规则：

- 识别到可操作回合时立即显示“分析中”
- 建议返回后更新为正式内容
- 失败时保留窗口并提示失败
- 操作完成后延迟约 1 秒隐藏

## 数据持久化

为了便于调试与复盘，需要新增持久化对象：

- `decision_frames`
- `advice_requests`
- `advice_results`

这些数据将写入 SQLite，并导出到 `session.json` 的扩展字段中。

## 配置项

通过环境变量支持：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `MAJSOUL_ADVICE_ENABLED`
- `MAJSOUL_ADVICE_TIMEOUT_MS`
- `MAJSOUL_ADVICE_STRATEGY`

## 错误处理

- 无 API Key：悬浮窗显示“未配置”
- 网络超时：显示“请求超时”
- JSON 非法：记录错误并显示“返回格式错误”
- 数据不足：显示“建议仅供参考”
- 新回合到来：取消旧请求，防止旧建议污染当前回合

## 测试策略

需要覆盖：

- 操作机会识别
- Prompt 输入构建
- 模型 JSON 解析与校验
- Coordinator 去重/取消/超时
- 悬浮窗状态切换
- 集成测试：模拟事件流触发建议与窗口更新

## 范围检查

本设计聚焦一个完整子系统：事实流驱动的实时建议与悬浮窗展示，没有扩展到自动点击执行，因此适合单独实现。

