# Student's friend · TypeScript 施工说明（给 DeepSeek）

把下面整份当作唯一需求。不要重写语音引擎。不要用 Flutter。不要把 API key 写进前端。

---

## 0. 你是谁、做什么、不做什么

你是桌面端工程师。任务是把 **PyQt 窗口**换成 **Electron + React + TypeScript**。  
Python 继续负责：麦克风 / Stereo Mix、VAD、faster-whisper、LLM 流式。

**做：**

- 无边框、置顶、半透明玻璃窗
- 现有全部交互（录音、自动监听、文字提问、复制、清空、透明度、置顶、模型切换）
- 用 JSON 行协议和 Python 引擎通信

**不要做：**

- 不要在 Node/浏览器里跑 Whisper
- 不要重写 `faster-whisper` / `sounddevice` / VAD
- 不要改简历 prompt 的语义
- 不要做登录、账号、云同步
- 不要引入 Next.js、Remix、Nest、Redux、Tailwind UI 组件库、antd、MUI

做完必须能在 Windows 上 `npm start` 弹出窗口，点 Listening 能走到 Python 录音。

---

## 1. 仓库现状（只读，先摸清再写代码）

根目录：`C:\Users\chenm\Desktop\interview-pilot`

| 文件 | 作用 |
| --- | --- |
| `app.py` | 现有 Python 单体：UI + 引擎。你要给它加无窗口 `--bridge` 模式 |
| `config.json` | 用户配置。TS 和 Python 都读写这一份 |
| `window_state.json` | 窗口位置尺寸 |
| `run.bat` | 最终改成启动 Electron（Electron 再拉起 Python） |
| `.venv\Scripts\python.exe` | 必须用这个解释器跑引擎 |

密钥从这里读，**前端永远不要读：**

`C:\Users\chenm\AppData\Local\hermes\.env`

里面有 `DEEPSEEK_API_KEY`、`OPENROUTER_API_KEY`。

---

## 2. 技术选型（不许改）

```
Electron 33+
Vite 6
React 18
TypeScript 5 strict
```

- 打包器：Vite。渲染进程不要 Webpack。
- 状态：React `useState` / `useReducer` 即可，不要 Redux。
- 样式：一个 `App.css`，CSS 变量。不要 Tailwind（玻璃窗要精确像素）。
- 图标：内联 SVG，不要 emoji，不要 icon font。
- 全局快捷键：`electron.globalShortcut`（F2 / F3 / F4）。窗口内 A / C / X。
- Python 子进程：`child_process.spawn(venvPython, ["app.py", "--bridge"], { cwd: repoRoot })`

目录：

```
desktop/
  package.json
  tsconfig.json
  vite.config.ts
  electron/
    main.ts          # 无边框窗、透明度、置顶、全局热键、spawn Python
    preload.ts       # contextBridge，只暴露白名单 API
    bridge.ts        # 读 Python stdout 的 JSON 行
  src/
    main.tsx
    App.tsx
    App.css
    types.ts
    components/
      TitleBar.tsx
      OpacityBar.tsx
      SideRail.tsx
      AnswerPane.tsx
      Waveform.tsx
      StatusBar.tsx
```

Windows 窗口必须：

```ts
frame: false
transparent: true
alwaysOnTop: true
hasShadow: false
backgroundColor: '#00000000'
minWidth: 720
minHeight: 520
width: 980
height: 700
```

`win.setIgnoreMouseEvents` 不要开。整窗可点。

---

## 3. 产品外观（按这个做，不要按旧 DESIGN_SPEC 的中文侧栏）

品牌名：**Student's friend**  
顶栏左侧：`Student's` 白色 + `friend` 青色 `#65d6f4`。前面一个准星 logo（圆 + 十字 + 中心点）。

### 3.1 颜色

```css
--bg: rgba(4, 13, 35, 0.90);
--stroke: rgba(158, 188, 235, 0.22);
--accent: #55c9f0;
--text: #f2f6ff;
--muted: #7f92b2;
--live: #ffc107;      /* 只有录音/监听用黄 */
--ok: #34d399;
--think: #22d3ee;
--danger: #f87171;
--rail: rgba(3, 12, 31, 0.42);
```

圆角窗口 20px，细青边，深海蓝玻璃。正文 **19px**，侧栏 **14px**，状态 **12px**。字体：`"Segoe UI", "Microsoft YaHei UI", sans-serif`。

### 3.2 布局

```
┌─────────────────────────────────────────────────────────────┐
│ [准星] Student's friend   [回答模型] [识别] [语言] [− 83% + ▬] │ 置顶 ─ ✕ │
├──────────┬──────────────────────────────────────────────────┤
│Listening │ CURRENT QUESTION / 当前问题                       │
│ ●        │ What is OOP?                                     │
│Auto   [A]│ ─────────────────────────────────                │
│──────────│ AI ANSWER / 实时回答                              │
│Copy   [C]│ 问：...                                          │
│Clear  [X]│ 答：...（流式，历史不清空）                        │
│          │                                                  │
│          │ [输入问题，按 Enter 生成回答…]     [生成回答]     │
│          │ [● 就绪          ~~~~波形~~~~]                    │
│          │ 就绪 · F2 录音 / F3 连续监听 / F4 清空            │
└──────────┴──────────────────────────────────────────────────┘
```

### 3.3 左侧操作轨（必须英文，必须 SVG）

| 项 | 图标 | 文案 | 徽标 | 行为 |
| --- | --- | --- | --- | --- |
| Listening | 圆圈里麦克风 | Listening | 无。监听/录音时右侧黄点 + 左侧 3px 青条高亮 | 手动录音 5 秒（等同 F2） |
| Auto | 耳朵 + 声波 | Auto | 深色方块 `A` | 开关连续监听（等同 F3） |
| 分隔线 | | | | Auto 和 Copy 之间一条细线 |
| Copy | 带横线的文档 | Copy | `C` | 复制**最新一条**回答 |
| Clear | 垃圾桶 | Clear | `X` | 清空问答历史，不关监听、不改模型 |

Listening 在 `listen` 或 `record` 时高亮：浅青底、青边、左竖条、黄点。Auto **不要**改成中文，不要高亮成 Listening 那种。

窗口未聚焦输入框时：`A` 开关 Auto，`C` Copy，`X` Clear。输入框聚焦时这三键当普通字母。

### 3.4 透明度条（不要用原生 number 的上下箭头）

可见控件：`−`  数字`83%`  `+`  横滑条。

- 范围 **10–100**
- `−` / `+` 每次 ±5，按住连发
- 滑块 1% 步进
- 实时 `win.setOpacity(value/100)`
- 写入 `config.json` 的 `ui.opacity`，**防抖 400ms**，不要每动一格就写盘
- 点这些控件时**禁止**拖动窗口

### 3.5 主区

- 标签可用 `CURRENT QUESTION` / `AI ANSWER`（英文小写间距青字），或中文「当前问题」「实时回答」，二选一，全应用同一套。
- **新问题不得清空历史。** 追加：

```
问：……
答：……

——
问：……
答：……
```

- 只有 Clear / F4 才清空。
- Copy 只复制最新 `答：` 那段，不是全文。
- 自动监听时，引擎会推 `partial`：当前问题行显示 `🎙 {text}…`，不要开新一轮问答。等正式 `question` 事件再追加一轮。

### 3.6 顶栏其它

- 回答模型下拉：来自 `config.json` 的 `models[]`
- 识别模型：`small` / `medium` / `large-v3-turbo` / `large-v3`，标签：

```
识别 small · 快
识别 medium
识别 turbo · 口音推荐
识别 large-v3 · 最强
```

- 语言：`自动` / `中文` / `English`，对应 `stt.language`: `null` / `"zh"` / `"en"`
- 置顶按钮文案：`置顶`，可切换 `alwaysOnTop`
- 最小化、关闭。关闭要杀掉 Python 子进程。

标题栏空白处拖动窗口。点到下拉、按钮、透明度条时不要拖。

---

## 4. Python 桥（你必须改 app.py，改动要小）

给 `app.py` 增加：

```
python app.py --bridge
```

行为：

- **不创建 QApplication / MainWindow**
- 仍加载 Whisper + 读 config + 读 Hermes .env
- stdin 读 JSON 行，stdout 写 JSON 行，`flush=True`，一行一个对象
- stderr 继续打日志，前端只解析 stdout

若当前 `app.py` 强依赖 Qt 信号，允许用一个无窗口 `QCoreApplication` 泵信号，但屏幕上不能再弹出 PyQt 窗。

### 4.1 前端 → 引擎（stdin）

每行一个 JSON。

```json
{"type":"manual"}
{"type":"toggle_listen"}
{"type":"ask","text":"What is OOP?"}
{"type":"set_llm","provider":"deepseek","model":"deepseek-v4-flash"}
{"type":"set_stt","model":"small"}
{"type":"set_lang","language":null}
{"type":"ping"}
```

`language` 可以是 `null` / `"zh"` / `"en"`。

忙碌时 `manual` / `ask` / 新 utterance 必须忽略（引擎已有 `_busy`）。

### 4.2 引擎 → 前端（stdout）

```json
{"type":"status","text":"正在录音 · 请说话（5 秒）"}
{"type":"state","state":"idle|record|listen|think"}
{"type":"partial","text":"What is object"}
{"type":"question","text":"What is Object-Oriented Programming?"}
{"type":"chunk","text":"OOP bundles data and behavior. "}
{"type":"done","stt":1.2,"llm":0.8,"ok":true}
{"type":"error","text":"转写失败：..."}
{"type":"ready"}
{"type":"pong"}
```

事件顺序（一次成功语音问答）：

1. `state: record`（手动）或 `state: listen`（自动已开）
2. `status` 转写中
3. `question`
4. `state: think` + `chunk` 多次
5. `done ok:true`
6. `state` 回到 `listen` 或 `idle`

失败：`error` + `done ok:false`。  
空语音文案必须是：`没有检测到有效语音，请再试一次`

### 4.3 引擎继续负责的事（不要搬到 TS）

- `record_seconds(5)`
- `Listener` 能量 VAD + 0.35s preroll
- `preprocess_audio`、幻觉过滤、beam search
- 边听边写 partial（约 1.2s 一次）
- DeepSeek `thinking: disabled`
- 回答语言跟随提问语言
- 从 Hermes `.env` 取 key

---

## 5. 前端状态机

```ts
type RunState = 'idle' | 'record' | 'listen' | 'think'
type Turn = { q: string; a: string }

type AppState = {
  run: RunState
  status: string
  currentQ: string
  turns: Turn[]          // 历史；当前轮是最后一项
  partial: string        // 非正式问题
  busy: boolean
  opacity: number
  pinned: boolean
  llm: { provider: string; model: string }
  stt: string
  lang: 'auto' | 'zh' | 'en'
}
```

`question` 到来：`turns.push({ q, a: '' })`，`currentQ = q`，**不要** `turns = []`。  
`chunk`：拼到 `turns.at(-1).a`。  
`partial`：只改 `currentQ` 预览，不 push。  
Clear：`turns = []`，`currentQ = '等待提问…'`，监听保持。

`busy === true` 时 Listening 点击无效，输入框仍可显示但生成按钮忽略。

---

## 6. Electron 主进程清单

1. 创建透明无边框窗，恢复 `window_state.json` `{x,y,w,h}`
2. `setOpacity` 来自 renderer 的 `opacity` 事件
3. `setAlwaysOnTop(pinned)`
4. `globalShortcut`：F2 → manual，F3 → toggle_listen，F4 → clear
5. spawn：

```
<repo>/.venv/Scripts/python.exe  app.py --bridge
```

工作目录 = 仓库根。`PYTHONUTF8=1`。

6. Python stdout 按 `\n` 切 JSON，转给 renderer
7. 窗口 close：`proc.kill()`，再写 `window_state.json`
8. preload 只暴露：

```ts
window.api.send(msg)
window.api.onEvent(cb)
window.api.setOpacity(n)
window.api.setPinned(b)
window.api.close()
window.api.minimize()
window.api.startDrag()   // 或 CSS -webkit-app-region: drag
```

`-webkit-app-region: drag` 用在标题栏空白；所有按钮、select、slider、input 设 `no-drag`。

---

## 7. 配置读写

`config.json` 已有结构，不要改字段名。TS 启动时读一次填下拉。  
改模型 / 语言 / 透明度：前端发桥消息，**同时**由 Python `save_config`（透明度也可由 Electron 写，但字段必须是 `ui.opacity`）。

`models` 数组原样渲染。当前选中用 `llm.provider` + `llm.model` 匹配。

识别模型列表写死在 TS（见 3.3），当前值 `stt.model`。

---

## 8. 验收（少一项都不算完）

- [ ] `npx electron .` 或 `npm start` 只出现 **一个** 玻璃窗，不再弹出 PyQt 窗
- [ ] 任务栏标题 `Student's friend`
- [ ] 侧栏四项英文 + SVG，Listening 监听时黄点高亮
- [ ] F2 录音 5 秒 → 问题出现 → 答案流式出来
- [ ] F3 打开后状态为监听；再说一句话会自动出回答
- [ ] 连续两问，第一问的问答还在，第二问追加在下面
- [ ] Copy 只复制最新答；没答案时状态栏：`还没有回答可复制`
- [ ] Clear 清显示，不关 Auto
- [ ] `−` `+` 能改透明度，拖滑块不拖动窗口，重启后透明度还在
- [ ] 置顶开关有效
- [ ] 输入框 Enter 和「生成回答」都能走同一套 ask
- [ ] 关窗口后 Python 进程消失（任务管理器里没有残留 python）
- [ ] 没有把 API key 打进渲染进程或日志

---

## 9. 施工顺序（按这个提交）

1. `desktop/` 空壳：透明窗 + 假数据 UI（先像素对齐侧栏和顶栏）
2. `app.py --bridge`：stdin/stdout 协议，用 `ping/pong` 测通
3. 接 `manual` / `ask` / `chunk` 流式
4. 接 Auto / partial / Copy / Clear
5. 透明度、置顶、窗口记忆
6. 改 `run.bat` 启动 `desktop`

每步都要能运行。不要先写三天架构再一次粘贴 2000 行。

---

## 10. 给 Python `--bridge` 的最小实现提示

可以保留现有 `Pipeline`、`Listener`。不要复制一份 Whisper 加载。

伪代码：

```python
# argparse 增加 --bridge
if args.bridge:
    run_bridge(cfg, keys)  # 无 MainWindow
    return
```

`run_bridge` 里：构造 `Pipeline`，用线程读 stdin；`Pipeline` 的四个 signal 改成 `print(json.dumps(...), flush=True)`。  
若继续用 `pyqtSignal`，就起 `QCoreApplication`，不要 `QWidget.show()`。

---

## 11. 禁止事项（再强调）

- 禁止 `localhost` 把音频 POST 到第三方 STT
- 禁止在 renderer 里 `fs.readFile` Hermes `.env`
- 禁止为了“好看”把历史改成只显示最后一条
- 禁止把 Listening 做成纯装饰，它必须触发录音
- 禁止 Flutter、React Native、Python WebView 套壳（那不是这次任务）

完。
