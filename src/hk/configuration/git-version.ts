export const MINIMUM_GLOBAL_HOOK_GIT_VERSION = "2.54.0"

export interface GitVersion {
  readonly major: number
  readonly minor: number
  readonly patch: number
}

export const parseGitVersion = (output: string): GitVersion | undefined => {
  const match = /^git version (\d+)\.(\d+)\.(\d+)/u.exec(output.trim())
  if (match === null) return undefined
  const [, major, minor, patch] = match
  if (major === undefined || minor === undefined || patch === undefined) return undefined
  return { major: Number(major), minor: Number(minor), patch: Number(patch) }
}

export const isGitVersionAtLeast = (version: GitVersion, minimum: GitVersion): boolean => {
  if (version.major !== minimum.major) return version.major > minimum.major
  if (version.minor !== minimum.minor) return version.minor > minimum.minor
  return version.patch >= minimum.patch
}

export const supportsGlobalGitHooks = (output: string): boolean => {
  const version = parseGitVersion(output)
  const minimum = parseGitVersion(`git version ${MINIMUM_GLOBAL_HOOK_GIT_VERSION}`)
  return version !== undefined && minimum !== undefined && isGitVersionAtLeast(version, minimum)
}

export const homebrewBinDirectories = (platform: NodeJS.Platform): ReadonlyArray<string> => {
  if (platform === "darwin") return ["/opt/homebrew/bin", "/opt/homebrew/sbin"]
  if (platform === "linux") return ["/home/linuxbrew/.linuxbrew/bin", "/home/linuxbrew/.linuxbrew/sbin"]
  return []
}

export const prependSearchPath = (directories: ReadonlyArray<string>, inheritedPath: string | undefined): string =>
  [...directories, ...(inheritedPath === undefined || inheritedPath === "" ? [] : [inheritedPath])].join(":")
