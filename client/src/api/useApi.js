import { useState, useEffect, useCallback, useRef } from 'react'

export function useApi(fetcher, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(async (externalSignal) => {
    const controller = externalSignal ? null : new AbortController()
    const signal = externalSignal || controller.signal
    setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current(signal)
      if (!signal.aborted) {
        setData(result)
      }
      return result
    } catch (err) {
      if (err?.name !== 'AbortError' && !signal.aborted) {
        setError(err)
      }
      return null
    } finally {
      if (!signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return undefined
    }
    const controller = new AbortController()
    run(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps])

  const refetch = useCallback(() => run(), [run])

  return {
    data,
    loading,
    error,
    isUnavailable: Boolean(error?.isUnavailable || error?.status === 503),
    refetch,
  }
}
