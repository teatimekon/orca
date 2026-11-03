import type { NotificationDispatchRequest } from '../../shared/notification-settings-types'

export type PiWebNotificationTarget = { worktreeId: string; sessionId: string }

/** The conversation a pi-web notification click opens (payload of `PI_WEB_IPC.openSession`), or null for any other surface. */
export function piWebNotificationTarget(
  args: NotificationDispatchRequest
): PiWebNotificationTarget | null {
  return args.surface === 'pi-web' && args.worktreeId && args.piWebSessionId
    ? { worktreeId: args.worktreeId, sessionId: args.piWebSessionId }
    : null
}
