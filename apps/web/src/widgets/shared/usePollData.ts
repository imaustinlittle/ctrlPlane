import { useState, useEffect, useCallback, useRef } from 'react'

interface PollState<T> {
  data:    T | null
  loading: boolean
  error:   string | null
}

/**
 * Polls `fetcher` immediately, then on a `intervalMs` cadence.
 * - Keeps showing stale data if a background refresh fails.
 * - Exponential backoff (doubles up to 60 s) on repeated errors.
 * - Effect re-runs whenever `deps` change, resetting backoff and data.
 * - Returns a `retry` function that immediately re-fetches and resets backoff.
 */
export function usePollData<T>(
  fetcher:    () => Promise<T>,
  intervalMs: number,
  deps:       React.DependencyList,
): PollState<T> & { retry: () => void } {
  const [state, setState] = useState<PollState<T>>({ data: null, loading: true, error: null })

  // Stable refs so the inner `run` closure never goes stale
  const cancelRef   = useRef(false)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffRef  = useRef(intervalMs)
  const fetcherRef  = useRef(fetcher)
  const runRef      = useRef<(() => Promise<void>) | null>(null)
  fetcherRef.current = fetcher   // always current, no re-trigger

  useEffect(() => {
    cancelRef.current  = false
    backoffRef.current = intervalMs
    setState({ data: null, loading: true, error: null })

    const run = async () => {
      if (cancelRef.current) return
      try {
        const data = await fetcherRef.current()
        if (cancelRef.current) return
        backoffRef.current = intervalMs          // reset backoff on success
        setState({ data, loading: false, error: null })
      } catch (e) {
        if (cancelRef.current) return
        const msg = (e as Error).message
        // Keep showing stale data; only replace with error on first load
        setState(s => ({ data: s.data, loading: false, error: msg }))
        backoffRef.current = Math.min(backoffRef.current * 2, 60_000)
      }
      if (!cancelRef.current) {
        timerRef.current = setTimeout(run, backoffRef.current)
      }
    }

    runRef.current = run
    run()

    return () => {
      cancelRef.current = true
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const retry = useCallback(() => {
    if (!runRef.current) return
    backoffRef.current = intervalMs
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setState(s => ({ data: s.data, loading: s.data === null, error: null }))
    runRef.current()
  }, [intervalMs])

  return { ...state, retry }
}
