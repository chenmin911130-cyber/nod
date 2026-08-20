# Nod — 实时 AI 面试助手

> Real-time AI interview copilot · 听题 → 转写 → 生成答案 → 透明置顶窗流式显示

**Copyright (c) 2026 Min Chen (`chenmin911130-cyber`). All rights reserved.**  本仓库不是开源软件。未经书面授权，禁止复制、修改、再分发、商用，也禁止将本代码作为学校作业 / 毕业项目提交。详见 [LICENSE](LICENSE) 与 [AUTHORSHIP.md](AUTHORSHIP.md)。

Nod 是一款桌面 AI 面试助手。开着它面试或练习时，它会自动听题、语音转写、调用大模型生成答案，并流式显示在一个半透明、始终置顶的小窗口里，供你边看边答。语音走 **AssemblyAI** 云端，回答走 **OpenRouter** 云端，**都用你自己的 key，不内置任何密钥**。

## ✨ 特点

- **自动监听**：按 `F3` 进入 Auto Listen，能量 VAD 自动检测面试官提问，检测到就自动生成答案。
- **抓系统音频**：同一台电脑上的 Teams / Zoom 面试，直接抓扬声器输出（WASAPI loopback），无需外放或外接设备。
- **流式答案**：答案逐字流式显示，首字约 1 秒可见，不用等生成完。
- **隐身模式**：`F9` 用 `WDA_EXCLUDEFROMCAPTURE` 把窗口从录屏 / 屏幕共享里隐藏。
- **口试速记式排版**：答案拆成「要点 + 一句话总结」，可直接照着念，一键复制。
- **本地优先的隐私**：音频流式处理、不落盘；key 只存本机 `%APPDATA%\Nod\secrets.json`。

## 🚀 快速开始

### 打包版（推荐）

1. 下载 `Nod Setup x.x.x.exe` 安装，或用 `Nod x.x.x.exe` 绿色版直接运行。
2. 首次启动会弹出面板，填写两个 key（OpenRouter + AssemblyAI，均只存本机）。
3. 按 `F3` 开始 Auto Listen，在 Teams / Zoom 里正常面试即可。

### 从源码运行（开发）

```bash
# Python 引擎（PyQt 本地 UI）
python app.py

# Electron 前端（推荐形态）
cd desktop && npm install && npm start
```

依赖：Python 3.12（`faster-whisper`、`sounddevice`、`soundcard`、`openai`、`PyQt5`、`websocket-client`）+ Node 18（Electron + React + TS）。

## ⌨️ 快捷键

| 按键 | 功能 |
|---|---|
| `F2` | 手动录音提问 |
| `F3` | Auto Listen（自动听题回答） |
| `F4` | 清空对话 |
| `F8` | 全屏 / 窗口切换 |
| `F9` | 隐身模式（录屏时隐藏窗口） |

## 🔑 API Key

- **开发**：从 Hermes `.env` 读取（`OPENROUTER_API_KEY` / `ASSEMBLYAI_API_KEY`）。
- **打包版**：首次启动填写，保存到 `%APPDATA%\Nod\secrets.json`（仅本机）。

获取 key：[openrouter.ai/keys](https://openrouter.ai/keys)（AI 回答，有免费额度）· [assemblyai.com/app](https://www.assemblyai.com/app)（语音转写，有免费额度）。

## ⚙️ 配置

用户配置在 `%APPDATA%\Nod\config.json`（不是安装目录），可编辑 `profile.resume_summary`（简历摘要）、`profile.target_role` / `company` / `jd`（目标岗位）、`profile.style`（回答风格）等。

## 🛠 技术栈

Electron + React + TypeScript（前端）· Python 引擎 + PyInstaller 打包 · faster-whisper / AssemblyAI（STT）· OpenRouter（LLM）· PyQt5（信号层）

## 🔒 隐私

- 音频**流式处理、本地不落盘**，退出即清空。
- 提问文本与简历/岗位会发送给 AssemblyAI / OpenRouter（境外）用于转写与生成——详见 [DISCLAIMER.md](DISCLAIMER.md)。
- 不内置任何作者的密钥；你的 key 只保存在本机。

## ⚠️ 免责声明

本软件仅供**学习与技术演示**。真实面试 / 考试中使用实时 AI 作答可能违反平台政策或学术诚信准则，风险自负。详见 [DISCLAIMER.md](DISCLAIMER.md)。

## 📄 版权与许可

Copyright (c) 2026 Min Chen. All rights reserved.

未经书面授权不得复制、修改、再分发或商用，也不得作为他人课业作业提交。详见 [LICENSE](LICENSE)、[NOTICE.md](NOTICE.md)、[AUTHORSHIP.md](AUTHORSHIP.md)。
