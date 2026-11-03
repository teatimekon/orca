import type { PiWebAttentionEvent } from '../../../../shared/pi-web/pi-web-status-types'

// Why: Task 9 replaces this no-op seam with completion and needs-input notifications.
export function dispatchPiWebAttention(_event: PiWebAttentionEvent): void {}
