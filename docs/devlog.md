# 开发与分析日志

## 2026-06-10
- 初始化 Git 并完成初始提交（chore: initial commit）
- 拉取外部参考仓库：latorc/MahjongCopilot（用于分析其“对局事实数据”获取逻辑）
- 完成 MahjongCopilot “事实数据获取”链路梳理（MITM WebSocket → liqi protobuf → ActionPrototype 事件回放）
- 新增 WebSocket 帧与 liqi 事件表（ws_frames/liqi_events），并接入 protobufjs 版 liqi 解析
- 新增 CDP WebSocket Tap：在 Electron 内捕获雀魂 WS 帧、落库并解析 ActionPrototype 事件流（session 生命周期绑定）
- 增强 smoke：在离屏加载雀魂时捕获 WS 帧并输出 liqi_events 片段与数量
