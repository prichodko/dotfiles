import { Console, Effect, Layer } from "effect"
import { CommandRunner } from "../process/command-runner.ts"
import { NotificationService, type NotificationStatus } from "./notification-service.ts"

const notify = Effect.fn("NotificationService.notify")(function*(status: NotificationStatus, message: string) {
  yield* Console.log(`dotfiles ${status}: ${message}`)
  const runner = yield* CommandRunner
  if (process.platform === "darwin" && process.env.TERM_PROGRAM !== undefined) {
    yield* runner.run({
      command: "osascript",
      args: ["-e", `display notification ${JSON.stringify(message)} with title ${JSON.stringify(`dotfiles ${status}`)}`],
      allowFailure: true
    })
    return
  }
  if (process.env.DISPLAY !== undefined || process.env.WAYLAND_DISPLAY !== undefined) {
    yield* runner.run({ command: "notify-send", args: [`dotfiles ${status}`, message], allowFailure: true })
  }
})

export const LiveNotificationServiceLayer = Layer.effect(NotificationService, Effect.gen(function*() {
  const runner = yield* CommandRunner
  return NotificationService.of({
    notify: (status, message) => notify(status, message).pipe(
      Effect.provideService(CommandRunner, runner),
      Effect.catch(() => Effect.void)
    )
  })
}))
