# MahjongCopilot 如何获取雀魂对局事实数据（分析报告）

本报告基于本地克隆的 `latorc/MahjongCopilot` 仓库代码阅读得出，重点聚焦“如何获取并重建对局事实数据（逐步事件流）”，不涉及其机器人决策部分。

## 总体链路
1. 网络层：使用 mitmproxy 作为本地代理，抓取雀魂客户端的 WebSocket 二进制帧。
2. 协议层：解析雀魂 liqi protobuf 协议。
3. 重建层：将 `ActionPrototype` 视为事件日志流（event sourcing），逐条喂给状态机重建对局事实；断线/中途进入通过 `syncGame` 的历史动作列表回放实现恢复。

## 关键代码路径
### 1) 抓取 WebSocket 帧（MITM）
- mitmproxy 拦截入口：[mitm.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/mitm.py#L29-L74)
  - `WSDataInterceptor.websocket_message()` 取 `flow.websocket.messages[-1].content`（二进制）并入队
- 消费队列并分发：[bot_manager.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/bot_manager.py#L254-L410)
  - `MitmController.get_message()` → `_process_msg()`

结论：MahjongCopilot 不是在浏览器页内 hook WebSocket，而是站在网络层截获原始 WS 帧，这对二进制协议最稳定。

### 2) liqi protobuf 解析（含 REQ/RES 配对）
- 帧类型判定：首字节 `1/2/3` 分别为 `Notify/Req/Res`：[liqi.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/liqi.py#L17-L27)
- REQ/RES 关联：通过 `msg_id`（buf[1:3] little-endian）记录响应类型映射：[liqi.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/liqi.py#L121-L147)
- 方法到 protobuf message 的映射：依赖 `liqi_proto/liqi.json`（服务/方法表）：[liqi.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/liqi.py#L80-L140)

结论：要在本项目重建“事实数据”，需要同样的三部分：帧类型判定、REQ/RES msg_id 配对上下文、方法→message schema 映射表。

### 3) ActionPrototype 二次解包（事实事件关键）
- NOTIFY 外层解包后得到 `{name, data}`，其中 `data` 为 base64 字符串：[liqi.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/liqi.py#L114-L118)
- `data` base64 解码后还要做 XOR decode（keys 生成与 decode 逻辑）：[liqi.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/liqi.py#L61-L77)
- 再根据 `name` 反序列化为对应 pb message

结论：`ActionPrototype` 是“逐步事实事件”的核心载体；如果只想做复盘事实记录，抓到并正确解包这一类消息就能构建事件序列。

## 对局事实的重建方式
### 1) 区分 Lobby 与 Game 的连接
- 通过 mitmproxy 的 `flow_id` 区分连接，并以 `authGame`(REQ) 作为进入对局的锚点建立 game_flow：[bot_manager.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/bot_manager.py#L368-L399)

### 2) 实时事件流（ActionPrototype）
- game_flow 的每条消息都先 `parse` 成 dict，再喂给 `GameState.input()`：[bot_manager.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/bot_manager.py#L352-L399)
- `method == .lq.ActionPrototype` 的 NOTIFY 作为事件流来源，用 `data.name`（如 `ActionNewRound/ActionDealTile/...`）驱动状态机推进：[game_state.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/game/game_state.py#L175-L201)

### 3) 断线/中途进入的恢复（syncGame 回放）
- 对 `syncGame/enterGame` 的响应，解析 `GameRestore.actions` 列表，并把每个 action 包装成“伪 NOTIFY ActionPrototype”逐条回放进 `GameState.input()`：[game_state.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/game/game_state.py#L146-L238)
- 回放辅助：`parse_syncGameActions()`：[liqi.py](file:///Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/liqi.py#L155-L173)

结论：这是可直接迁移的工程骨架：把 `syncGame` 中的历史动作也视为事件流的一部分，统一走同一个输入管线，从而保证恢复与实时一致。

## 对本项目的可迁移优化点
### 方案候选
1. 继续纯视觉（现有）：简单、无需协议，但事实完整性上限低。
2. 代理/抓包（MahjongCopilot 方案）：事实最完整，但需要安装证书、配置代理，桌面分发成本高。
3. Electron 内置调试协议抓 WS（推荐）：通过 `webContents.debugger`（CDP）监听 `Network.webSocketFrameReceived/Sent`，直接获取 WS 帧数据；不需要系统代理与证书；视觉作为兜底。

### 推荐迁移策略（高层）
- 先在本项目做“抓取层”：在 Electron 中挂载 CDP，收集 WS 帧（base64），写入 SQLite 与导出。
- 再做“协议层”：移植 liqi 协议解析（帧类型、msg_id 配对、ActionPrototype 二次解包）。
- 最后做“重建层”：事件流落盘（ActionPrototype + syncGame 回放），并把当前视觉识别作为“UI 结构/截图证据”兜底与调试佐证。
