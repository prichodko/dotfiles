---
title: Don't Reset State in Effects on Prop Changes
impact: MEDIUM
impactDescription: avoids extra renders with stale values
tags: rerender, state, props, derived-state, useEffect
---

## Don't Reset State in Effects on Prop Changes

When you need to reset *some* (not all) state when a prop changes, don't use an effect — it causes an extra render with stale values. Usually you can restructure state to eliminate the need for reset entirely.

**Incorrect (effect resets state — extra render with stale selection):**

```tsx
function List({ items }: { items: Item[] }) {
  const [selection, setSelection] = useState<Item | null>(null)

  // 🔴 Effect causes: render with stale selection → DOM update → effect → re-render
  useEffect(() => {
    setSelection(null)
  }, [items])

  return <>{items.map(item => (
    <li key={item.id} onClick={() => setSelection(item)}>
      {item.name} {selection?.id === item.id && '✓'}
    </li>
  ))}</>
}
```

**Incorrect (render-time adjustment — works but hard to follow):**

```tsx
function List({ items }: { items: Item[] }) {
  const [selection, setSelection] = useState<Item | null>(null)

  // Stores previous props to detect changes during render
  const [prevItems, setPrevItems] = useState(items)
  if (items !== prevItems) {
    setPrevItems(items)
    setSelection(null)
  }

  // ...
}
```

This avoids the extra render but is confusing. React discards the in-progress render and retries immediately. Use only as a last resort.

**Correct (store ID, derive during render — no reset needed):**

```tsx
function List({ items }: { items: Item[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Derived during render — if item is gone, selection is automatically null
  const selection = items.find(item => item.id === selectedId) ?? null

  return <>{items.map(item => (
    <li key={item.id} onClick={() => setSelectedId(item.id)}>
      {item.name} {selection?.id === item.id && '✓'}
    </li>
  ))}</>
}
```

By storing the `selectedId` instead of the object, there's nothing to reset. When `items` changes, the derivation handles it: if the item still exists it stays selected, otherwise `selection` becomes `null`.

**When to use each approach:**

- **Derive during render** (best) — restructure state so reset is unnecessary
- **Reset all state with `key`** — when *all* state should reset (see `rerender-reset-with-key`)
- **Render-time adjustment** (last resort) — when you truly can't derive or use `key`

Reference: [You Might Not Need an Effect — Adjusting some state when a prop changes](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
