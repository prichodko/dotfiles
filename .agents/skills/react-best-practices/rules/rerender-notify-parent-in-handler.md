---
title: Notify Parent in Event Handler, Not Effect
impact: MEDIUM
impactDescription: single render pass instead of two
tags: rerender, useEffect, parent, onChange, event-handler
---

## Notify Parent in Event Handler, Not Effect

When a component needs to notify its parent about a state change, call the parent callback in the same event handler — not in an effect that watches the state.

**Incorrect (two render passes):**

```tsx
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false)

  useEffect(() => {
    onChange(isOn)
  }, [isOn, onChange])

  function handleClick() {
    setIsOn(!isOn)
  }
}
```

Toggle renders with new state, then the effect fires `onChange`, causing the parent to re-render — two passes.

**Correct (single pass, batched):**

```tsx
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false)

  function updateToggle(nextIsOn: boolean) {
    setIsOn(nextIsOn)
    onChange(nextIsOn)
  }

  function handleClick() {
    updateToggle(!isOn)
  }

  function handleDragEnd(e: React.DragEvent) {
    updateToggle(isCloserToRightEdge(e))
  }
}
```

React batches both updates (local + parent) into one render.

**Even better — lift state up entirely:**

```tsx
function Toggle({ isOn, onChange }: { isOn: boolean; onChange: (v: boolean) => void }) {
  return <button onClick={() => onChange(!isOn)}>{isOn ? 'On' : 'Off'}</button>
}
```

When two components need to stay in sync, consider lifting the state to the parent instead of syncing via callbacks.

Reference: [https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes](https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes)
