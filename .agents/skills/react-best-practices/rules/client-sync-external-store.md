---
title: Use useSyncExternalStore for External Subscriptions
impact: MEDIUM
impactDescription: correct concurrent-safe subscription
tags: client, useSyncExternalStore, subscription, external-store
---

## Use useSyncExternalStore for External Subscriptions

Use `useSyncExternalStore` instead of manual `useEffect` + `addEventListener` + `setState` for subscribing to external data sources.

**Incorrect (manual subscription in effect):**

```tsx
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    function update() {
      setIsOnline(navigator.onLine)
    }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return isOnline
}
```

**Correct (purpose-built hook):**

```tsx
function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true // server snapshot
  )
}
```

`useSyncExternalStore` is concurrent-safe and avoids tearing (showing inconsistent state across the UI during concurrent renders). The manual effect approach can tear in concurrent mode.

**Common use cases:**

- Browser APIs (`navigator.onLine`, `matchMedia`, `localStorage`)
- Third-party state libraries without React bindings
- WebSocket connection status
- Any mutable value outside React's state management

Reference: [https://react.dev/reference/react/useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
