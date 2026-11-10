import type { Step } from '../types'

export function StepsList({ steps }: { steps: Step[] }) {
  if (steps.length === 0) return <p className="muted">No steps yet.</p>

  return (
    <ol className="steps">
      {steps.map((step, index) => (
        <li key={index} className="step">
          <span className="step-title">{step.title}</span>
          {step.type === 'shell' && <code className="step-command">{step.content}</code>}
        </li>
      ))}
    </ol>
  )
}
