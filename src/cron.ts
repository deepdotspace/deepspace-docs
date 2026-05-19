/**
 * Cron task definitions — registered into the AppCronRoom DO at construction
 * time (worker.ts). The DO alarm fires `runTask(name, env)` on the schedule
 * declared here; the DO itself records executions, tracks history, and
 * pushes status to admin clients via the `/ws/cron/:roomId` WebSocket.
 *
 * Each task declares EITHER `intervalMinutes` (run every N minutes) OR
 * `schedule` + `timezone` (5-field cron expression).
 */

import type { CronTask } from 'deepspace/worker'

export const tasks: CronTask[] = []

export async function runTask(_name: string, _env: unknown): Promise<void> {
  // No-op — implement your cron tasks here. Dispatch on `_name`.
}
