import type { ProjectFiles, Step } from '../types'

const ACTION_REGEX = /<boltAction\s+([^>]*)>([\s\S]*?)<\/boltAction>/g

function getAttribute(attributes: string, name: string): string | undefined {
  return new RegExp(`${name}="([^"]*)"`).exec(attributes)?.[1]
}

/**
 * Turns the <boltArtifact>/<boltAction> markup produced by the backend
 * (template prompts and LLM responses) into a list of steps.
 */
export function parseXml(response: string): Step[] {
  const steps: Step[] = []

  for (const match of response.matchAll(ACTION_REGEX)) {
    const attributes = match[1] ?? ''
    const content = (match[2] ?? '').replace(/^\n/, '')
    const type = getAttribute(attributes, 'type')

    if (type === 'file') {
      const path = getAttribute(attributes, 'filePath')
      if (!path) continue
      steps.push({ type: 'file', title: `Create ${path}`, path, content })
    } else if (type === 'shell') {
      steps.push({ type: 'shell', title: 'Run command', content: content.trim() })
    }
  }

  return steps
}

/** Applies file steps on top of the existing project files. */
export function applySteps(files: ProjectFiles, steps: Step[]): ProjectFiles {
  const next = { ...files }
  for (const step of steps) {
    if (step.type === 'file' && step.path) {
      next[step.path.replace(/^\.?\//, '')] = step.content
    }
  }
  return next
}

/** Removes the artifact markup, leaving only the LLM's explanation text. */
export function stripArtifact(response: string): string {
  return response.replace(/<boltArtifact[\s\S]*?<\/boltArtifact>/g, '').trim()
}
