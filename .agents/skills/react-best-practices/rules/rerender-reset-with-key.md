---
title: Reset State with Key, Not Effects
impact: MEDIUM
impactDescription: avoids stale state and extra renders
tags: rerender, key, reset, state, useEffect
---

## Reset State with Key, Not Effects

Use React's `key` prop to reset component state when a prop changes, instead of effects that clear state manually.

**Incorrect (extra render with stale value):**

```tsx
function ProfilePage({ userId }) {
  const [comment, setComment] = useState('')

  useEffect(() => {
    setComment('')
  }, [userId])

  return <textarea value={comment} onChange={e => setComment(e.target.value)} />
}
```

The component renders with the stale comment first, then the effect clears it causing a second render. Every piece of nested state needs its own reset effect.

**Correct (key forces remount with fresh state):**

```tsx
function ProfilePage({ userId }) {
  return <Profile key={userId} userId={userId} />
}

function Profile({ userId }) {
  const [comment, setComment] = useState('')
  return <textarea value={comment} onChange={e => setComment(e.target.value)} />
}
```

When `userId` changes, React unmounts the old `Profile` and mounts a new one. All state — including nested children — resets automatically.

**Also works for resetting third-party integrations:**

```tsx
// Bad: reset via effect dependency
useEffect(() => { loadVideo(videoId) }, [videoId])

// Good: remount via key
<VideoPlayer key={videoId} videoId={videoId} />
```

Use `key` when all (or most) state should reset on a prop change. If only one piece of state needs adjusting, derive it during render instead.

Reference: [https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes](https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes)
