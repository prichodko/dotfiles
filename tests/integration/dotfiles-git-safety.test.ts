import { afterEach, describe, expect, test } from "bun:test"
import { BunServices } from "@effect/platform-bun"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Layer } from "effect"
import { DotfilesRepository } from "../../src/dotfiles/repository/dotfiles-repository.ts"
import { makeLiveDotfilesRepositoryLayer } from "../../src/dotfiles/repository/live-dotfiles-repository.ts"
import { synchronizeDotfiles } from "../../src/dotfiles/sync/synchronize-dotfiles.ts"
import { RepositoryValidation } from "../../src/dotfiles/validation/validate-repository.ts"
import { NotificationService } from "../../src/notification/notification-service.ts"
import { CommandRunner } from "../../src/process/command-runner.ts"
import { EffectCommandRunnerLayer } from "../../src/process/effect-command-runner.ts"

const temporaryRoots: Array<string> = []
const isolatedGitEnvironment = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  HK: "0"
} as const

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const command = (cwd: string, args: ReadonlyArray<string>): string => {
  const result = Bun.spawnSync([args[0] ?? "", ...args.slice(1)], {
    cwd,
    env: { ...process.env, ...isolatedGitEnvironment },
    stdout: "pipe",
    stderr: "pipe"
  })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}

interface RepositoryFixture {
  readonly root: string
  readonly local: string
  readonly peer: string
  readonly remote: string
  readonly state: string
}

const makeRepositoryFixture = (): RepositoryFixture => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "dotfiles-git-safety-")))
  temporaryRoots.push(root)
  const seed = join(root, "seed")
  const remote = join(root, "remote.git")
  const local = join(root, "local")
  const peer = join(root, "peer")
  const state = join(root, "state")
  mkdirSync(seed)
  command(seed, ["git", "init", "-b", "main"])
  command(seed, ["git", "config", "user.email", "test@example.com"])
  command(seed, ["git", "config", "user.name", "Test"])
  command(seed, ["git", "config", "commit.gpgsign", "false"])
  writeFileSync(join(seed, "one.txt"), "one\n")
  writeFileSync(join(seed, "two.txt"), "two\n")
  command(seed, ["git", "add", "."])
  command(seed, ["git", "commit", "-m", "initial"])
  command(root, ["git", "init", "--bare", remote])
  command(seed, ["git", "remote", "add", "origin", remote])
  command(seed, ["git", "push", "-u", "origin", "main"])
  command(root, ["git", "clone", "--branch", "main", remote, local])
  command(root, ["git", "clone", "--branch", "main", remote, peer])
  for (const repository of [local, peer]) {
    command(repository, ["git", "config", "user.email", "test@example.com"])
    command(repository, ["git", "config", "user.name", "Test"])
    command(repository, ["git", "config", "commit.gpgsign", "false"])
  }
  return { root, local: realpathSync(local), peer: realpathSync(peer), remote, state }
}

const makeRepositoryLayer = (
  fixture: RepositoryFixture,
  beforePush?: (attempt: 0 | 1) => Effect.Effect<void>,
  beforeLockPublish?: Effect.Effect<void>
) => {
  const liveRunner = EffectCommandRunnerLayer.pipe(Layer.provide(BunServices.layer))
  const runner = Layer.effect(CommandRunner, Effect.gen(function*() {
    const live = yield* CommandRunner
    return CommandRunner.of({
      run: (input) => live.run({
        ...input,
        env: { ...input.env, ...isolatedGitEnvironment }
      })
    })
  })).pipe(Layer.provide(liveRunner))
  const platform = Layer.merge(BunServices.layer, runner)
  return makeLiveDotfilesRepositoryLayer({
    repositoryRoot: fixture.local,
    stateRoot: fixture.state,
    platform: "darwin",
    applyManagedFiles: Effect.void,
    ...(beforePush === undefined ? {} : { beforePush }),
    ...(beforeLockPublish === undefined ? {} : { beforeLockPublish })
  }).pipe(Layer.provide(platform))
}

const runSynchronization = (fixture: RepositoryFixture, beforePush?: (attempt: 0 | 1) => Effect.Effect<void>) => synchronizeDotfiles.pipe(
  Effect.provide(Layer.mergeAll(
    makeRepositoryLayer(fixture, beforePush),
    Layer.succeed(RepositoryValidation, RepositoryValidation.of({
      validateSource: Effect.void,
      validateApplied: Effect.void,
      validate: Effect.void
    })),
    Layer.succeed(NotificationService, NotificationService.of({ notify: () => Effect.void }))
  ))
)

const pushPeerChange = (fixture: RepositoryFixture, file: string, content: string): void => {
  writeFileSync(join(fixture.peer, file), content)
  command(fixture.peer, ["git", "add", file])
  command(fixture.peer, ["git", "commit", "-m", `peer ${file}`])
  command(fixture.peer, ["git", "push", "origin", "main"])
}

describe("real Git synchronization safety", () => {
  test("rejects staged additions", async () => {
    const fixture = makeRepositoryFixture()
    writeFileSync(join(fixture.local, "added.txt"), "added\n")
    command(fixture.local, ["git", "add", "added.txt"])
    const exit = await Effect.runPromiseExit(DotfilesRepository.use((repository) => repository.stageTrackedChanges).pipe(Effect.provide(makeRepositoryLayer(fixture))))
    expect(exit._tag).toBe("Failure")
    expect(command(fixture.local, ["git", "diff", "--cached", "--name-only"])).toBe("added.txt")
  })

  test("rebases peer changes and preserves untracked files", async () => {
    const fixture = makeRepositoryFixture()
    pushPeerChange(fixture, "two.txt", "peer\n")
    writeFileSync(join(fixture.local, "one.txt"), "local\n")
    writeFileSync(join(fixture.local, "untracked.txt"), "keep\n")
    const state = await Effect.runPromise(runSynchronization(fixture))
    expect(state._tag).toBe("Completed")
    expect(readFileSync(join(fixture.local, "two.txt"), "utf8")).toBe("peer\n")
    expect(readFileSync(join(fixture.local, "untracked.txt"), "utf8")).toBe("keep\n")
  }, 15_000)

  test("retries one real push race", async () => {
    const fixture = makeRepositoryFixture()
    writeFileSync(join(fixture.local, "one.txt"), "local\n")
    let raced = false
    const state = await Effect.runPromise(runSynchronization(fixture, (attempt) => Effect.sync(() => {
      if (attempt !== 0 || raced) return
      raced = true
      pushPeerChange(fixture, "two.txt", "race\n")
    })))
    expect(state).toMatchObject({ _tag: "Completed", retryCount: 1 })
  }, 15_000)

  test("does not retry a rejected push when upstream is unchanged", async () => {
    const fixture = makeRepositoryFixture()
    const hook = join(fixture.remote, "hooks", "pre-receive")
    writeFileSync(hook, "#!/bin/sh\nexit 1\n")
    chmodSync(hook, 0o755)
    writeFileSync(join(fixture.local, "one.txt"), "local\n")
    const exit = await Effect.runPromiseExit(runSynchronization(fixture))
    expect(exit._tag).toBe("Failure")
    expect(command(fixture.local, ["git", "rev-parse", "HEAD"])).not.toBe(command(fixture.local, ["git", "rev-parse", "refs/remotes/origin/main"]))
  }, 15_000)

  test("preserves a conflict worktree and keeps the live tree clean", async () => {
    const fixture = makeRepositoryFixture()
    pushPeerChange(fixture, "one.txt", "peer\n")
    writeFileSync(join(fixture.local, "one.txt"), "local\n")
    const exit = await Effect.runPromiseExit(runSynchronization(fixture))
    expect(exit._tag).toBe("Failure")
    expect(readFileSync(join(fixture.local, "one.txt"), "utf8")).toBe("local\n")
    expect(command(fixture.local, ["git", "status", "--porcelain=v1"])).toBe("")
    expect(existsSync(join(fixture.state, "worktrees"))).toBe(true)
  }, 15_000)

  test("recovers stale locks, rejects active and invalid locks, and cleans up interruption", async () => {
    const fixture = makeRepositoryFixture()
    const layer = makeRepositoryLayer(fixture)
    const lock = join(fixture.state, "sync.lock")
    const writeLock = (pid: string, startedAt = new Date().toISOString()) => {
      mkdirSync(lock, { recursive: true })
      writeFileSync(join(lock, "pid"), pid)
      writeFileSync(join(lock, "host"), command(fixture.root, ["hostname", "-s"]))
      writeFileSync(join(lock, "started_at"), startedAt)
      writeFileSync(join(lock, "repository"), fixture.local)
    }
    writeLock("99999999")
    await Effect.runPromise(DotfilesRepository.use((repository) => repository.acquireLock.pipe(Effect.andThen(repository.releaseLock))).pipe(Effect.provide(layer)))
    expect(existsSync(lock)).toBe(false)
    writeLock(String(process.pid))
    expect((await Effect.runPromiseExit(DotfilesRepository.use((repository) => repository.acquireLock).pipe(Effect.provide(layer))))._tag).toBe("Failure")
    rmSync(lock, { recursive: true })
    mkdirSync(lock, { recursive: true })
    writeFileSync(join(lock, "pid"), "partial")
    expect((await Effect.runPromiseExit(DotfilesRepository.use((repository) => repository.acquireLock).pipe(Effect.provide(layer))))._tag).toBe("Failure")
    rmSync(lock, { recursive: true })
    await Effect.runPromiseExit(DotfilesRepository.use((repository) => Effect.acquireRelease(repository.acquireLock, () => repository.releaseLock).pipe(
      Effect.andThen(Effect.never), Effect.scoped, Effect.timeout("20 millis")
    )).pipe(Effect.provide(layer)))
    expect(existsSync(lock)).toBe(false)
  })

  test("removes partial lock metadata when publication is interrupted", async () => {
    const fixture = makeRepositoryFixture()
    const layer = makeRepositoryLayer(fixture, undefined, Effect.never)
    await Effect.runPromiseExit(DotfilesRepository.use((repository) => repository.acquireLock).pipe(
      Effect.provide(layer),
      Effect.timeout("20 millis")
    ))
    expect(existsSync(join(fixture.state, "sync.lock"))).toBe(false)
    expect(command(fixture.state, ["find", ".", "-maxdepth", "1", "-name", "sync.lock.pending-*"])).toBe("")
  })
})
