import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process'
import * as path from 'path'

export interface BridgeEvents {
  onEvent: (e: unknown) => void
  onLog: (line: string) => void
  onExit: (code: number | null) => void
}

// 负责拉起 Python 引擎(.venv 解释器跑 app.py --bridge；打包版跑 resources/engine/nod-engine.exe)
// 并解析 stdout 的 JSON 行。
export class PythonBridge {
  private proc: ChildProcessWithoutNullStreams | null = null
  private buffer = ''

  constructor(
    private repoRoot: string,
    private events: BridgeEvents,
    private isPackaged = false,
  ) {}

  start(): void {
    const env: Record<string, string | undefined> = { ...process.env, PYTHONUTF8: '1' }
    // 关键: 清掉 PYTHONPATH, 否则 hermes-agent venv 的 numpy(cp311) 会污染本项目 venv(cp312)
    delete env.PYTHONPATH

    let cmd: string
    let args: string[]
    let cwd: string
    if (this.isPackaged) {
      // 打包版: engine exe 随 extraResources 分发, config.json 在引擎目录
      cmd = path.join(process.resourcesPath, 'engine', 'nod-engine.exe')
      args = ['--bridge']
      cwd = path.join(process.resourcesPath, 'engine')
    } else {
      const venvPython = path.join(this.repoRoot, '.venv', 'Scripts', 'python.exe')
      cmd = venvPython
      args = ['app.py', '--bridge']
      cwd = this.repoRoot
    }

    this.proc = spawn(cmd, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    this.proc.stdout.setEncoding('utf8')
    this.proc.stdout.on('data', (chunk: string) => this.onStdout(chunk))

    this.proc.stderr.setEncoding('utf8')
    this.proc.stderr.on('data', (chunk: string) => {
      for (const line of chunk.split('\n')) {
        if (line.trim()) this.events.onLog(line)
      }
    })

    this.proc.on('exit', (code) => this.events.onExit(code))
    this.proc.on('error', (err) => this.events.onLog(`spawn error: ${err.message}`))
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (!line) continue
      try {
        this.events.onEvent(JSON.parse(line))
      } catch {
        // 非 JSON 行(如 [STT] 日志) → 当日志处理, 不丢给渲染进程
        this.events.onLog(line)
      }
    }
  }

  send(msg: unknown): void {
    if (this.proc && this.proc.stdin.writable) {
      this.proc.stdin.write(JSON.stringify(msg) + '\n')
    }
  }

  kill(): void {
    if (this.proc) {
      const pid = this.proc.pid
      if (pid && process.platform === 'win32') {
        // uv 生成的 venv python.exe 是转发器, 会再拉起真正的 Python312\python.exe。
        // proc.kill() 只杀直接子进程(转发器), 真正的解释器会变孤儿残留。
        // 用 taskkill /T 杀整棵进程树。
        try {
          spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
        } catch {
          /* ignore */
        }
      }
      try {
        this.proc.kill()
      } catch {
        /* ignore */
      }
      this.proc = null
    }
  }
}
