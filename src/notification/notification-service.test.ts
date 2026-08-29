import { expect, test } from "bun:test"
import { Effect } from "effect"
import { makeRecordingNotificationService } from "./recording-notification-service.ts"
import { NotificationService } from "./notification-service.ts"

test("records notifications", async () => {
  const recording = await Effect.runPromise(makeRecordingNotificationService)
  await Effect.runPromise(Effect.gen(function*() {
    const service = yield* NotificationService
    yield* service.notify("success", "done")
  }).pipe(Effect.provide(recording.layer)))
  expect(await Effect.runPromise(recording.notifications)).toEqual([{ status: "success", message: "done" }])
})
