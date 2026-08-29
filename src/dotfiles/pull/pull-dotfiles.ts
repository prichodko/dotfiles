import { Effect } from "effect"
import { NotificationService } from "../../notification/notification-service.ts"
import { DotfilesRepository } from "../repository/dotfiles-repository.ts"
import { RepositoryValidation } from "../validation/validate-repository.ts"

export const pullDotfiles = Effect.gen(function*() {
  const repository = yield* DotfilesRepository
  const validation = yield* RepositoryValidation
  const notifications = yield* NotificationService
  yield* Effect.acquireRelease(repository.acquireLock, () => repository.releaseLock)
  yield* repository.requirePullPreconditions
  const upstreamSha = yield* repository.fetchMain
  yield* repository.fastForwardTo(upstreamSha)
  yield* validation.validate
  yield* repository.applyManagedFiles
  yield* notifications.notify("success", "Pulled and applied origin/main.")
}).pipe(
  Effect.onExit((exit) => exit._tag === "Failure"
    ? NotificationService.use((service) => service.notify("failure", "Pull stopped."))
    : Effect.void),
  Effect.scoped
)
