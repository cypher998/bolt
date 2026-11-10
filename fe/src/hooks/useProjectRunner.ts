import { useCallback, useEffect, useRef, useState } from 'react'
import type { WebContainer, WebContainerProcess } from '@webcontainer/api'
import type { ProjectFiles, RunStatus } from '../types'
import { toFileSystemTree } from '../utils/fileTree'

// Strip ANSI colour/cursor codes so the terminal output is readable as text.
const ANSI_REGEX = /\x1b\[[0-9;?]*[a-zA-Z]/g // eslint-disable-line no-control-regex
const MAX_LOG_LENGTH = 50_000

/**
 * Mounts project files into the WebContainer, installs dependencies,
 * starts the dev server and exposes the preview URL + terminal logs.
 */
export function useProjectRunner(webcontainer: WebContainer | undefined) {
  const [status, setStatus] = useState<RunStatus>('idle')
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [logs, setLogs] = useState('')
  const serverProcess = useRef<WebContainerProcess | null>(null)
  const lastPackageJson = useRef<string | undefined>(undefined)

  const appendLog = useCallback((chunk: string) => {
    setLogs((prev) => (prev + chunk.replace(ANSI_REGEX, '')).slice(-MAX_LOG_LENGTH))
  }, [])

  useEffect(() => {
    if (!webcontainer) return
    const unsubscribeReady = webcontainer.on('server-ready', (_port, url) => {
      setPreviewUrl(url)
      setStatus('running')
    })
    const unsubscribeError = webcontainer.on('error', (e) => {
      appendLog(`\n[webcontainer error] ${e.message}\n`)
      setStatus('error')
    })
    return () => {
      unsubscribeReady()
      unsubscribeError()
    }
  }, [webcontainer, appendLog])

  const spawn = useCallback(
    async (command: string, args: string[]) => {
      appendLog(`\n$ ${command} ${args.join(' ')}\n`)
      const process = await webcontainer!.spawn(command, args)
      process.output.pipeTo(new WritableStream({ write: appendLog }))
      return process
    },
    [webcontainer, appendLog],
  )

  const startServer = useCallback(
    async (files: ProjectFiles) => {
      serverProcess.current?.kill()
      serverProcess.current = null

      setStatus('installing')
      const install = await spawn('npm', ['install'])
      if ((await install.exit) !== 0) {
        appendLog('\nnpm install failed.\n')
        setStatus('error')
        return
      }

      setStatus('starting')
      let scripts: Record<string, string> = {}
      try {
        scripts = JSON.parse(files['package.json'] ?? '{}').scripts ?? {}
      } catch {
        appendLog('\nCould not parse package.json.\n')
      }

      const [command, args] = scripts.dev
        ? ['npm', ['run', 'dev']]
        : scripts.start
          ? ['npm', ['start']]
          : ['node', ['index.js']]
      const process = await spawn(command as string, args as string[])
      serverProcess.current = process

      // Projects without a web server (e.g. plain Node scripts) just exit.
      process.exit.then((code) => {
        if (serverProcess.current !== process) return
        appendLog(`\nProcess exited with code ${code}.\n`)
        setStatus((s) => (s === 'running' ? s : code === 0 ? 'running' : 'error'))
      })
    },
    [spawn, appendLog],
  )

  /**
   * Writes all files into the container. The dev server is (re)started on the
   * first run or when package.json changed; otherwise Vite's HMR picks up the edits.
   */
  const run = useCallback(
    async (files: ProjectFiles) => {
      if (!webcontainer) return
      try {
        setStatus('mounting')
        await webcontainer.mount(toFileSystemTree(files))

        const packageJson = files['package.json']
        const isViteDevServer = !!previewUrl && packageJson?.includes('"dev"')
        if (!serverProcess.current || packageJson !== lastPackageJson.current || !isViteDevServer) {
          lastPackageJson.current = packageJson
          await startServer(files)
        } else {
          setStatus('running')
        }
      } catch (e) {
        appendLog(`\n${e instanceof Error ? e.message : String(e)}\n`)
        setStatus('error')
      }
    },
    [webcontainer, previewUrl, startServer, appendLog],
  )

  return { status, setStatus, previewUrl, logs, run }
}
