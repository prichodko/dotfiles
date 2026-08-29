import { Effect, Layer, Ref } from "effect"
import { NotificationService, type NotificationStatus } from "./notification-service.ts"

export interface RecordedNotification {
  readonly status: NotificationStatus
  readonly message: string
}

export const makeRecordingNotificationService = Effect.gen(function*() {
  const notifications = yield* Ref.make<ReadonlyArray<RecordedNotification>>([])
  return {
    layer: Layer.succeed(NotificationService, NotificationService.of({
      notify: (status, message) => Ref.update(notifications, (items) => [...items, { status, message }])
    })),
    notifications: Ref.get(notifications)
  }
})
