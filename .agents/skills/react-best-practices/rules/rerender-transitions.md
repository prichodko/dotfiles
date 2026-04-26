---
title: Use Transitions for Non-Urgent Updates
impact: MEDIUM
impactDescription: maintains UI responsiveness
tags: rerender, transitions, startTransition, performance
---

## Use Transitions for Non-Urgent Updates

Mark non-urgent state updates as transitions to maintain UI responsiveness.

**Incorrect (typing blocks while results re-render):**

```tsx
function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Item[]>([])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setResults(filterItems(e.target.value)) // blocks input while filtering
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      <ResultsList results={results} />
    </>
  )
}
```

**Correct (input stays responsive, results update when ready):**

```tsx
import { startTransition } from 'react'

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Item[]>([])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    startTransition(() => {
      setResults(filterItems(e.target.value))
    })
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      <ResultsList results={results} />
    </>
  )
}
```

**Note:** For high-frequency position tracking (scroll, resize), prefer `useRef` with direct DOM manipulation instead — see `rerender-use-ref-transient-values`.
