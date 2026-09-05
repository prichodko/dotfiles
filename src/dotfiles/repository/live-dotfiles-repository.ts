import { fileURLToPath } from "node:url"
import { Effect, FileSystem, Layer } from "effect"
import { CommandRunner, describeCommandError } from "../../process/command-runner.ts"
import { buildCommitMessage, sortPaths } from "../publish/commit-message.ts"
import { DotfilesRepository, DotfilesRepositoryFailure, type RebasePreflightResult } from "./dotfiles-repository.ts"
import { findDisallowedLockUpdatePaths } from "./lock-update-paths.ts"

export const DOTFILES_ROOT = fileURLToPath(new URL("../../../", import.meta.url)).replace(/\/$/, "")

export interface LiveDotfilesRepositoryOptions {
  readonly repositoryRoot?: string
  readonly stateRoot?: string
  readonly platform?: NodeJS.Platform
  readonly applyManagedFiles?: Effect.Effect<void>
  readonly validateCheckout?: (checkout: string) => Effect.Effect<void, DotfilesRepositoryFailure>
  readonly beforePush?: (attempt: 0 | 1) => Effect.Effect<void>
  readonly beforeLockPublish?: Effect.Effect<void>
}

const lines = (output: string): ReadonlyArray<string> => sortPaths(output.split("\n").filter((line) => line.length > 0))
const nulSeparatedPaths = (output: string): ReadonlyArray<string> => output.split("\0").filter((path) => path.length > 0)

export const makeLiveDotfilesRepositoryLayer = (options: LiveDotfilesRepositoryOptions = {}) => Layer.effect(DotfilesRepository, Effect.gen(function*() {
  const runner = yield* CommandRunner
  const fileSystem = yield* FileSystem.FileSystem
  const repositoryRoot = options.repositoryRoot ?? DOTFILES_ROOT
  const stateRoot = options.stateRoot ?? `${process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`}/dotfiles`
  const lockPath = `${stateRoot}/sync.lock`
  let ownsLock = false
  let pushAttempt: 0 | 1 = 0

  const fail = (operation: string, detail: string, cause?: unknown) => new DotfilesRepositoryFailure({
    operation,
    detail,
    ...(cause === undefined ? {} : { cause })
  })
  const command = (program: string, args: ReadonlyArray<string>, options: { readonly allowFailure?: boolean; readonly interactive?: boolean; readonly env?: Readonly<Record<string, string | undefined>> } = {}) =>
    runner.run({ command: program, args, cwd: repositoryRoot, ...options }).pipe(
      Effect.mapError((cause) => fail(program, describeCommandError(cause), cause))
    )
  const git = (args: ReadonlyArray<string>, allowFailure = false) => command("git", ["-C", repositoryRoot, ...args], { allowFailure })
  const requireBranch = Effect.gen(function*() {
    const branch = (yield* git(["symbolic-ref", "--quiet", "--short", "HEAD"])).stdout.trim()
    if (branch !== "main") return yield* fail("preconditions", `The current branch must be main. Current branch: ${branch}`)
  })
  const requireNoOperation = Effect.gen(function*() {
    for (const marker of ["rebase-apply", "rebase-merge", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"]) {
      const path = (yield* git(["rev-parse", "--path-format=absolute", "--git-path", marker])).stdout.trim()
      if (yield* fileSystem.exists(path).pipe(Effect.mapError((cause) => fail("preconditions", "Could not inspect Git operation state.", cause)))) {
        return yield* fail("preconditions", "A Git merge, rebase, cherry-pick, or revert is active.")
      }
    }
  })
  const requireRepository = git(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap((result) =>
    result.stdout.trim() === repositoryRoot ? Effect.void : Effect.fail(fail("preconditions", "Repository root mismatch."))
  ))
  const requireCleanTracked = git(["status", "--porcelain=v1", "--untracked-files=no"]).pipe(Effect.flatMap((result) =>
    result.stdout.trim() === "" ? Effect.void : Effect.fail(fail("preconditions", "Tracked local changes exist. Review and commit them before updating."))
  ))
  const requireOnlyLockUpdateChanges = Effect.gen(function*() {
    const changedPaths = nulSeparatedPaths((yield* git(["diff", "--name-only", "-z", "HEAD", "--"])).stdout)
    const disallowedPaths = findDisallowedLockUpdatePaths(changedPaths)
    if (disallowedPaths.length === 0) return
    return yield* fail("preconditions", `Lock updates cannot include unrelated tracked changes: ${disallowedPaths.join(", ")}`)
  })
  const releaseLock = Effect.gen(function*() {
    if (!ownsLock) return
    yield* fileSystem.remove(lockPath, { recursive: true, force: true }).pipe(Effect.catch(() => Effect.void))
    ownsLock = false
  })
  const writeLock = Effect.gen(function*() {
    const hostname = (yield* command("hostname", ["-s"], { allowFailure: true })).stdout.trim() || "unknown"
    const pendingLockPath = `${stateRoot}/sync.lock.pending-${process.pid}-${crypto.randomUUID()}`
    yield* Effect.gen(function*() {
      yield* fileSystem.makeDirectory(pendingLockPath)
      yield* Effect.all([
        fileSystem.writeFileString(`${pendingLockPath}/pid`, String(process.pid)),
        fileSystem.writeFileString(`${pendingLockPath}/host`, hostname),
        fileSystem.writeFileString(`${pendingLockPath}/started_at`, new Date().toISOString()),
        fileSystem.writeFileString(`${pendingLockPath}/repository`, repositoryRoot)
      ])
      if (options.beforeLockPublish !== undefined) yield* options.beforeLockPublish
      yield* fileSystem.rename(pendingLockPath, lockPath)
      ownsLock = true
    }).pipe(Effect.onExit(() => fileSystem.remove(pendingLockPath, { recursive: true, force: true }).pipe(Effect.catch(() => Effect.void))))
  })
  const acquireLock = Effect.gen(function*() {
    yield* fileSystem.makeDirectory(stateRoot, { recursive: true })
    const exists = yield* fileSystem.exists(lockPath)
    if (!exists) return yield* writeLock
    const metadata = yield* Effect.all({
      pid: fileSystem.readFileString(`${lockPath}/pid`),
      host: fileSystem.readFileString(`${lockPath}/host`),
      startedAt: fileSystem.readFileString(`${lockPath}/started_at`),
      repository: fileSystem.readFileString(`${lockPath}/repository`)
    }).pipe(Effect.mapError((cause) => fail("lock", `Lock metadata is invalid: ${lockPath}`, cause)))
    const currentHost = (yield* command("hostname", ["-s"], { allowFailure: true })).stdout.trim() || "unknown"
    if (metadata.repository.trim() !== repositoryRoot || !/^\d+$/.test(metadata.pid.trim()) || !/^\d{4}-\d{2}-\d{2}T/.test(metadata.startedAt.trim())) {
      return yield* fail("lock", `Lock metadata is invalid: ${lockPath}`)
    }
    if (metadata.host.trim() !== currentHost) return yield* fail("lock", `The lock belongs to another host: ${metadata.host.trim()}`)
    const pid = Number(metadata.pid.trim())
    const active = yield* Effect.sync(() => {
      try { process.kill(pid, 0); return true } catch { return false }
    })
    if (active) return yield* fail("lock", `Another dotfiles process is active with PID ${pid}.`)
    yield* fileSystem.remove(lockPath, { recursive: true, force: true }).pipe(Effect.mapError((cause) => fail("lock", "Could not remove the stale lock.", cause)))
    return yield* writeLock.pipe(Effect.mapError((cause) => fail("lock", "Could not acquire the lock.", cause)))
  }).pipe(Effect.mapError((cause) => cause instanceof DotfilesRepositoryFailure ? cause : fail("lock", "Could not acquire the lock.", cause)))

  const trackedDiff = git(["diff", "--binary", "HEAD", "--"]).pipe(Effect.map((result) => result.stdout))
  const waitForStableChanges = Effect.gen(function*() {
    let previous = yield* trackedDiff
    for (let elapsed = 0; elapsed < 30; elapsed += 2) {
      yield* Effect.sleep("2 seconds")
      const current = yield* trackedDiff
      if (current === previous) return
      previous = current
    }
    return yield* fail("stability", "Tracked files did not become stable within 30 seconds.")
  })
  const stageTrackedChanges = Effect.gen(function*() {
    const additions = lines((yield* git(["diff", "--cached", "--diff-filter=A", "--name-only"])).stdout)
    if (additions.length > 0) return yield* fail("stage", `New staged files are not permitted:\n${additions.join("\n")}`)
    yield* git(["add", "--update"])
    return lines((yield* git(["diff", "--cached", "--name-only"])).stdout)
  })
  const commitStagedChanges = (paths: ReadonlyArray<string>) => Effect.gen(function*() {
    if (paths.length === 0) return undefined
    const message = buildCommitMessage(paths)
    const args = ["commit", "-m", message.subject]
    if (message.body !== undefined) args.push("-m", message.body)
    yield* git(args)
    return (yield* git(["rev-parse", "HEAD"])).stdout.trim()
  })
  const fetchMain = git(["fetch", "origin", "main"]).pipe(
    Effect.andThen(git(["rev-parse", "--verify", "refs/remotes/origin/main"])),
    Effect.map((result) => result.stdout.trim())
  )
  const preflightRebase = (upstreamSha: string): Effect.Effect<RebasePreflightResult, DotfilesRepositoryFailure> => Effect.gen(function*() {
    const identity = `${new Date().toISOString().replace(/[^0-9]/g, "")}-${process.pid}-${Math.floor(Math.random() * 1_000_000)}`
    const branch = `dotfiles-sync-preflight-${identity}`
    const worktreePath = `${stateRoot}/worktrees/${identity}`
    yield* fileSystem.makeDirectory(`${stateRoot}/worktrees`, { recursive: true }).pipe(Effect.mapError((cause) => fail("preflight", "Could not create the worktree directory.", cause)))
    yield* git(["worktree", "add", "-b", branch, worktreePath, "main"])
    const rebase = yield* command("git", ["-C", worktreePath, "rebase", upstreamSha], { allowFailure: true })
    if (rebase.exitCode !== 0) return { _tag: "Conflict", conflictWorktreePath: worktreePath }
    yield* git(["worktree", "remove", worktreePath])
    yield* git(["branch", "-D", branch])
    return { _tag: "Passed" }
  })
  const rebaseLiveMain = (upstreamSha: string) => git(["merge-base", "--is-ancestor", upstreamSha, "main"], true).pipe(
    Effect.flatMap((ancestor) => ancestor.exitCode === 0 ? Effect.void : git(["rebase", upstreamSha]).pipe(
      Effect.catch((cause) => git(["rebase", "--abort"], true).pipe(Effect.andThen(Effect.fail(cause)))),
      Effect.asVoid
    ))
  )
  const validatePublication = Effect.gen(function*() {
    yield* requireCleanTracked
    const commitSha = (yield* git(["rev-parse", "HEAD"])).stdout.trim()
    const checkout = `${stateRoot}/validation/${crypto.randomUUID()}`
    const validateCheckout = options.validateCheckout ?? ((path: string) => Effect.gen(function*() {
      const env = { MISE_TRUSTED_CONFIG_PATHS: path, MISE_IGNORED_CONFIG_PATHS: `${process.env.HOME}/.config/mise/config.toml:${path}/.config/mise/config.toml` }
      yield* command("mise", ["-C", path, "--locked", "exec", "--", "bun", "install", "--frozen-lockfile", "--ignore-scripts"], { env })
      yield* command("mise", ["-C", path, "--locked", "exec", "--", "bun", "run", "tasks/dotfiles/check-source.ts"], { env })
    }))
    yield* fileSystem.makeDirectory(`${stateRoot}/validation`, { recursive: true }).pipe(
      Effect.mapError((cause) => fail("validation", "Could not create the validation directory.", cause))
    )
    yield* Effect.acquireUseRelease(
      git(["worktree", "add", "--detach", checkout, commitSha]),
      () => validateCheckout(checkout),
      () => git(["worktree", "remove", "--force", checkout]).pipe(Effect.catch(() => Effect.void))
    )
    return commitSha
  })
  const pushMain = (commitSha: string) => Effect.gen(function*() {
    const attempt = pushAttempt
    pushAttempt = 1
    if (options.beforePush !== undefined) yield* options.beforePush(attempt)
    return (yield* git(["push", "origin", `${commitSha}:refs/heads/main`], true)).exitCode === 0
  })
  const verifyPublishedHead = Effect.gen(function*() {
    yield* git(["fetch", "origin", "main"])
    const [local, remote] = yield* Effect.all([
      git(["rev-parse", "HEAD"]).pipe(Effect.map((result) => result.stdout.trim())),
      git(["rev-parse", "refs/remotes/origin/main"]).pipe(Effect.map((result) => result.stdout.trim()))
    ])
    if (local !== remote) return yield* fail("verify", "Local HEAD does not match origin/main.")
  })
  const applyManagedFiles = options.applyManagedFiles ?? command("bash", [`${repositoryRoot}/tasks/machine/apply`]).pipe(Effect.asVoid)
  const listUntrackedFiles = git(["ls-files", "--others", "--exclude-standard"]).pipe(Effect.map((result) => lines(result.stdout)))
  const fastForwardTo = (upstreamSha: string) => git(["merge-base", "--is-ancestor", "HEAD", upstreamSha], true).pipe(
    Effect.flatMap((ancestor) => ancestor.exitCode === 0
      ? git(["merge", "--ff-only", upstreamSha]).pipe(Effect.asVoid)
      : Effect.fail(fail("pull", "Local main cannot fast-forward to origin/main. Reconcile it with Git or use dotfiles:publish on a trusted Mac.")))
  )

  return DotfilesRepository.of({
    requirePublishPreconditions: Effect.gen(function*() {
      if ((options.platform ?? process.platform) !== "darwin") return yield* fail("preconditions", "dotfiles:publish can run only on macOS.")
      yield* requireRepository
      yield* requireNoOperation
      yield* requireBranch
    }),
    requirePullPreconditions: Effect.all([requireRepository, requireNoOperation, requireBranch, requireCleanTracked], { discard: true }),
    requireLockUpdatePreconditions: Effect.all([
      requireRepository,
      requireNoOperation,
      requireBranch,
      requireOnlyLockUpdateChanges
    ], { discard: true }),
    acquireLock,
    releaseLock,
    waitForStableChanges,
    stageTrackedChanges,
    commitStagedChanges,
    fetchMain,
    preflightRebase,
    rebaseLiveMain,
    validatePublication,
    pushMain,
    verifyPublishedHead,
    applyManagedFiles,
    listUntrackedFiles,
    fastForwardTo
  })
}))

export const LiveDotfilesRepositoryLayer = makeLiveDotfilesRepositoryLayer()
