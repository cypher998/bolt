import type { RunStatus } from '../types'

const STATUS_TEXT: Record<RunStatus, string> = {
  idle: 'Waiting for project files…',
  generating: 'Generating your project…',
  mounting: 'Writing files into the WebContainer…',
  installing: 'Installing dependencies (npm install)…',
  starting: 'Starting the dev server…',
  running: 'The project is running, but it did not start a web server. Check the terminal output.',
  error: 'Something went wrong. Check the terminal output below.',
}

interface PreviewFrameProps {
  url?: string
  status: RunStatus
}

export function PreviewFrame({ url, status }: PreviewFrameProps) {
  if (!url) {
    return <div className="preview-placeholder">{STATUS_TEXT[status]}</div>
  }

  return (
    <div className="preview">
      <div className="preview-bar">
        <span className="preview-url">{url}</span>
        <a href={url} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </a>
      </div>
      <iframe src={url} title="Preview" allow="cross-origin-isolated" />
    </div>
  )
}
