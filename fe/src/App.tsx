import { useMemo, useState } from 'react'
import { FileExplorer } from './components/FileExplorer'
import { PreviewFrame } from './components/PreviewFrame'
import { StepsList } from './components/StepsList'
import { useProjectRunner } from './hooks/useProjectRunner'
import { useWebContainer } from './hooks/useWebContainer'
import type { ChatMessage, ProjectFiles, Step } from './types'
import { toTreeNodes } from './utils/fileTree'
import { applySteps, parseXml, stripArtifact } from './utils/parseXml'
import './App.css'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(`${url} failed with status ${res.status}${data?.message ? `: ${data.message}` : ''}`)
  }
  return res.json() as Promise<T>
}

function App() {
  const [started, setStarted] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [files, setFiles] = useState<ProjectFiles>({})
  const [selectedPath, setSelectedPath] = useState<string>()
  const [tab, setTab] = useState<'code' | 'preview'>('preview')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string>()

  const { webcontainer, error: bootError } = useWebContainer()
  const { status, setStatus, previewUrl, logs, run } = useProjectRunner(webcontainer)
  const tree = useMemo(() => toTreeNodes(files), [files])
  const busy = status === 'generating' || status === 'mounting' || status === 'installing'

  async function sendToLlm(history: ChatMessage[], baseFiles: ProjectFiles) {
    const { response } = await postJson<{ response: string }>('/chat', { messages: history })
    if (typeof response !== 'string') throw new Error('/chat returned no response text.')
    const newSteps = parseXml(response)
    const nextFiles = applySteps(baseFiles, newSteps)
    setSteps((prev) => [...prev, ...newSteps])
    setFiles(nextFiles)
    setNotes(stripArtifact(response))
    setMessages([...history, { role: 'assistant', content: response }])
    await run(nextFiles)
  }

  async function handleStart() {
    if (!prompt.trim()) return
    setStarted(true)
    setError(undefined)
    setStatus('generating')
    try {
      const { prompts, uiPrompts } = await postJson<{ prompts: string[]; uiPrompts: string[] }>('/template', {
        userPrompt: prompt,
      })
      const templateSteps = parseXml(uiPrompts[0] ?? '')
      const templateFiles = applySteps({}, templateSteps)
      setSteps(templateSteps)
      setFiles(templateFiles)

      const history: ChatMessage[] = [...prompts, prompt].map((content) => ({ role: 'user', content }))
      setPrompt('')
      await sendToLlm(history, templateFiles)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  async function handleFollowUp() {
    if (!prompt.trim()) return
    setError(undefined)
    setStatus('generating')
    const history: ChatMessage[] = [...messages, { role: 'user', content: prompt }]
    setPrompt('')
    try {
      await sendToLlm(history, files)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  if (!started) {
    return (
      <main className="home">
        <h1>What do you want to build?</h1>
        <p className="muted">Describe your app and it will be generated and run right here in your browser.</p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A todo app with dark mode and local storage"
          rows={5}
        />
        <button type="button" className="primary" onClick={handleStart} disabled={!prompt.trim()}>
          Generate
        </button>
        {bootError && <p className="error">WebContainer failed to boot: {bootError}</p>}
      </main>
    )
  }

  return (
    <main className="builder">
      <aside className="sidebar">
        <h2>Steps</h2>
        <StepsList steps={steps} />
        {notes && <p className="notes">{notes}</p>}
        {error && <p className="error">{error}</p>}
        {bootError && <p className="error">WebContainer failed to boot: {bootError}</p>}
        <div className="follow-up">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask for changes…"
            rows={3}
          />
          <button type="button" className="primary" onClick={handleFollowUp} disabled={busy || !prompt.trim()}>
            {status === 'generating' ? 'Generating…' : 'Send'}
          </button>
        </div>
      </aside>

      <section className="explorer">
        <h2>Files</h2>
        <FileExplorer nodes={tree} selectedPath={selectedPath} onSelect={(path) => {
          setSelectedPath(path)
          setTab('code')
        }} />
      </section>

      <section className="workspace">
        <div className="tabs">
          <button type="button" className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')}>
            Code
          </button>
          <button type="button" className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>
            Preview
          </button>
          <span className="status">{status}</span>
        </div>
        <div className="tab-body">
          {tab === 'code' ? (
            <pre className="code">
              {selectedPath ? files[selectedPath] : 'Select a file to view its code.'}
            </pre>
          ) : (
            <PreviewFrame url={previewUrl} status={status} />
          )}
        </div>
        <pre className="terminal">{logs || 'Terminal output will appear here.'}</pre>
      </section>
    </main>
  )
}

export default App
