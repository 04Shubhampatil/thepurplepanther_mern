import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Data fetching for a page.
 *
 * Guards against setting state after unmount, and discards stale responses by sequence
 * number so a slow earlier request cannot overwrite a fast later one when the user
 * navigates or changes a filter quickly.
 */
export function useApi(fetcher, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const mounted = useRef(true)
  const sequence = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async () => {
    const id = sequence.current + 1
    sequence.current = id

    setLoading(true)
    setError(null)

    try {
      const result = await fetcher()
      if (mounted.current && id === sequence.current) setData(result)
      return result
    } catch (err) {
      if (mounted.current && id === sequence.current) setError(err)
      return null
    } finally {
      if (mounted.current && id === sequence.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (immediate) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, immediate])

  return { data, error, loading, refetch: run, setData }
}

export default useApi
