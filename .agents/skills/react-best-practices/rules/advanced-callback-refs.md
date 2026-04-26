---
title: Use Callback Refs for DOM Measurement
impact: LOW
impactDescription: reliable DOM side effects on mount
tags: advanced, ref, callback-ref, dom, measurement
---

## Use Callback Refs for DOM Measurement

Use callback refs instead of `useRef` + `useEffect` when you need to measure or interact with a DOM node as soon as it mounts. Callback refs fire exactly when the node attaches or detaches.

**Incorrect (ref may be null during effect):**

```tsx
function MeasuredBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (ref.current) {
      setHeight(ref.current.getBoundingClientRect().height)
    }
  }, [])

  return <div ref={ref}>Content</div>
}
```

This breaks with conditional rendering or Suspense — the effect runs before the node exists.

**Correct (callback ref fires on attach):**

```tsx
function MeasuredBox() {
  const [height, setHeight] = useState(0)

  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setHeight(node.getBoundingClientRect().height)
    }
  }, [])

  return <div ref={measuredRef}>Content</div>
}
```

**React 19+ supports cleanup in callback refs:**

```tsx
function ChatInput() {
  const ref = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.focus()
      // cleanup runs when node detaches
      return () => { /* cleanup */ }
    }
  }, [])

  return <input ref={ref} />
}
```

Use callback refs when: measuring layout, integrating third-party DOM libraries, or focusing elements on mount — especially with conditional rendering or Suspense boundaries.
