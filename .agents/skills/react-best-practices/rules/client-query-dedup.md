---
title: Use React Query for Automatic Deduplication
impact: MEDIUM-HIGH
impactDescription: automatic deduplication
tags: client, react-query, deduplication, data-fetching
---

## Use React Query for Automatic Deduplication

React Query enables request deduplication, caching, and revalidation across component instances.

**Incorrect (no deduplication, each instance fetches):**

```tsx
function UserList() {
  const [users, setUsers] = useState([])
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers)
  }, [])
}
```

**Correct (multiple instances share one request):**

```tsx
import { useQuery } from '@tanstack/react-query'

function UserList() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
  })
}
```

**For immutable data:**

```tsx
import { useQuery } from '@tanstack/react-query'

function StaticContent() {
  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then(r => r.json()),
    staleTime: Infinity,
  })
}
```

**For mutations:**

```tsx
import { useMutation } from '@tanstack/react-query'

function UpdateButton() {
  const { mutate } = useMutation({ mutationFn: updateUser })
  return <button onClick={() => mutate()}>Update</button>
}
```

Reference: [https://tanstack.com/query](https://tanstack.com/query)
