# 模板资源

当前识别模块支持从目录中加载 JSON 模板文件并做最小化模板匹配。

## 使用方式

启动前设置：

```bash
export MAJSOUL_TEMPLATES_DIR="$(pwd)/assets/templates"
```

模板目录下的每个 `*.json` 文件可包含：

```json
{
  "tiles": [{ "id": "1m", "rgba": [200, 0, 0, 255] }],
  "digits": [{ "id": "1", "rgba": [0, 0, 200, 255] }]
}
```

`rgba` 是一个占位的“纯色模板”格式，便于先把流水线跑通；后续可以扩展为真实牌面截图模板（例如存 luma 数组）并在匹配逻辑中启用。

