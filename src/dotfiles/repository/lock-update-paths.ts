const allowedLockUpdatePaths = new Set([
  "mise/conf.d/core.toml",
  "mise.full.toml",
  "mise.lock",
  "mise.full.lock"
])

export const findDisallowedLockUpdatePaths = (paths: ReadonlyArray<string>): ReadonlyArray<string> =>
  paths.filter((path) => !allowedLockUpdatePaths.has(path))
