# Nod 变更日志（Changelog）

## 1.1.0（2026-08-16）

### 安全与信任
- 配置与密钥分离：API key 从 `config.json` 移入独立的 `secrets.json`，前端与配置往返不再携带密钥。
- **开源版首次运行填 key**：不再内置作者测试 key；首次启动弹出面板填写 OpenRouter（AI 回答）+ AssemblyAI（语音转写），保存到 `%APPDATA%\Nod\secrets.json`（仅本机）。引擎新增 `save_keys` 命令 + `keys_status` 事件，无 key 时 bridge 不退出而是提示填写。
- 用户配置移出安装目录：`config.json` / `window_state.json` 迁至 `%APPDATA%\Nod\`，装到 Program Files 等受保护目录也能正常保存。
- 保存失败不再静默：引擎通过 bridge 明确报错、透明度保存失败弹系统对话框。
- 修复：`pack_engine.bat` 原本复制 `config.json`（开发者简历），改为复制 `config.client.json`（空简历）。
- 移除硬编码的开发者本机 `.env` 绝对路径（改为 `%LOCALAPPDATA%\hermes\.env` 动态解析）。

### 发布
- 版本号统一由 `desktop/package.json` 管理，构建产物自动带版本号。
- 统一发布物：单一正式候选包 `Nod-<version>-Client-Package.zip`，附 `SHA256SUMS.txt` + `RELEASE.txt`（版本 / 构建时间 / Git 提交 / 哈希）。
- 隐私说明补齐四要素：数据流向、使用谁的额度、保存时长、如何撤回同意。

### 待办（需决策，未实施）
- 代码签名：需购买证书（OV/EV）+ 时间戳签名，尚未实施。
- 密钥分发方式：客户版仍内嵌作者测试 key；「首次运行填 key」方案待定。

## 1.0.0（2026-08）
- 首个客户测试包（安装版 + 绿色版，未签名）。
