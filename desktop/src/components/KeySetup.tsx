import { useCallback, useState } from 'react'

interface Props {
  hasLlm: boolean
  hasStt: boolean
}

export default function KeySetup({ hasLlm, hasStt }: Props) {
  const [orKey, setOrKey] = useState('')
  const [aaKey, setAaKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = useCallback(() => {
    if (!orKey.trim() && !aaKey.trim()) {
      setErr('请至少填写一个 key')
      return
    }
    setSaving(true)
    setErr('')
    window.api.send({
      type: 'save_keys',
      openrouter_key: orKey.trim(),
      assemblyai_key: aaKey.trim(),
    })
    // 引擎会回 keys_status，父组件据此切走本面板；这里留个兜底复位
    setTimeout(() => setSaving(false), 1500)
  }, [orKey, aaKey])

  const open = (url: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    window.api.openExternal(url)
  }

  return (
    <div className="keysetup">
      <div className="keysetup-card">
        <div className="keysetup-title">Nod · 需要 API Keys</div>
        <p className="keysetup-desc">
          首次使用需填写两个 key。二者都<b>只保存在本机</b>（<code>%APPDATA%\Nod\secrets.json</code>），
          不会上传给作者或任何第三方。
        </p>

        <label className="keysetup-field">
          <span>
            OpenRouter API Key · AI 回答{!hasLlm && <em className="keysetup-missing">（缺少）</em>}
          </span>
          <input
            type="password"
            placeholder="sk-or-…"
            value={orKey}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setOrKey(e.target.value)}
          />
          <a href="https://openrouter.ai/keys" onClick={open('https://openrouter.ai/keys')}>
            获取 key → openrouter.ai/keys
          </a>
        </label>

        <label className="keysetup-field">
          <span>
            AssemblyAI API Key · 语音转写{!hasStt && <em className="keysetup-missing">（缺少）</em>}
          </span>
          <input
            type="password"
            placeholder="粘贴 AssemblyAI key"
            value={aaKey}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setAaKey(e.target.value)}
          />
          <a href="https://www.assemblyai.com/app" onClick={open('https://www.assemblyai.com/app')}>
            获取 key → assemblyai.com/app
          </a>
        </label>

        {err && <div className="keysetup-err">{err}</div>}
        <button className="keysetup-save" onClick={save} disabled={saving}>
          {saving ? '保存中…' : '保存并开始'}
        </button>
        <p className="keysetup-note">
          没有 key？OpenRouter 与 AssemblyAI 都提供免费额度。想换 key 时删除{' '}
          <code>%APPDATA%\Nod\secrets.json</code> 再重启即可重新填写。
        </p>
      </div>
    </div>
  )
}
