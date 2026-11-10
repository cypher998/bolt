export type StepType = 'file' | 'shell'

export interface Step {
  type: StepType
  title: string
  // For file steps: the file path. For shell steps: undefined.
  path?: string
  // For file steps: the file contents. For shell steps: the command.
  content: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Flat map of project files: "src/App.tsx" -> contents
export type ProjectFiles = Record<string, string>

export type RunStatus =
  | 'idle'
  | 'generating'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'running'
  | 'error'
