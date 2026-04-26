---
title: Hoist Static I/O to Module Level
impact: HIGH
impactDescription: avoids repeated file/network I/O per request
tags: server, io, performance, server-functions
---

## Hoist Static I/O to Module Level

**Impact: HIGH (avoids repeated file/network I/O per request)**

When loading static assets (fonts, logos, config files) in server functions or route handlers, hoist the I/O operation to module level. Module-level code runs once when the module is first imported, not on every request.

**Incorrect: reads config on every call**

```typescript
export async function processRequest(data: Data) {
  const config = JSON.parse(
    await fs.readFile('./config.json', 'utf-8')
  )
  const template = await fs.readFile('./template.html', 'utf-8')

  return render(template, data, config)
}
```

**Correct: loads once at module level**

```typescript
const configPromise = fs.readFile('./config.json', 'utf-8')
  .then(JSON.parse)
const templatePromise = fs.readFile('./template.html', 'utf-8')

export async function processRequest(data: Data) {
  const [config, template] = await Promise.all([
    configPromise,
    templatePromise
  ])

  return render(template, data, config)
}
```

**When to use this pattern:**

- Reading configuration files that don't change at runtime
- Loading static templates (email, HTML)
- Loading fonts, logos, or watermarks for server-side rendering
- Any static asset that's the same across all requests

**When NOT to use this pattern:**

- Assets that vary per request or user
- Files that may change during runtime (use caching with TTL instead)
- Large files that would consume too much memory if kept loaded
- Sensitive data that shouldn't persist in memory
