import { useEffect, useState } from 'react'

/** O valor, mas só depois de `delay` ms sem mudar — para não consultar a cada tecla. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return settled
}
