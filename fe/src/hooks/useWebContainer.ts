import { useEffect, useState } from 'react'
import { WebContainer } from '@webcontainer/api'

// WebContainer.boot() may only be called once per page, so the instance is
// shared at module level (this also survives React StrictMode double effects).
let bootPromise: Promise<WebContainer> | null = null

export function useWebContainer() {
  const [webcontainer, setWebcontainer] = useState<WebContainer>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    bootPromise ??= WebContainer.boot({ coep: 'credentialless' })
    bootPromise.then(setWebcontainer).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e))
    })
  }, [])

  return { webcontainer, error }
}
