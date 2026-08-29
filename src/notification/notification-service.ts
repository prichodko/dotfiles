import { Context, Effect } from "effect"

export type NotificationStatus = "success" | "failure"

export class NotificationService extends Context.Service<NotificationService, {
  readonly notify: (status: NotificationStatus, message: string) => Effect.Effect<void>
}>()("dotfiles/notification/NotificationService") {}
