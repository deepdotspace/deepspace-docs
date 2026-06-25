import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { claimInvites } from './claim-invites'

export const actions: Record<string, ActionHandler<Env>> = {
  claimInvites,
}
