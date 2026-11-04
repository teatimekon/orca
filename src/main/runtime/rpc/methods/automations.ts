import { defineMethod } from '../core'
import { pureUnavailable } from './pure-unavailable'
import {
  AutomationCreate,
  AutomationId,
  AutomationList,
  AutomationRuns,
  AutomationUpdate
} from '../../../../shared/rpc-contract/automation-params'

/** zyx/orca-pure: automations are removed; the RPC names stay and answer `runtime_unavailable`. */
export const AUTOMATION_METHODS = [
  defineMethod({
    name: 'automation.list',
    permission: 'workspace',
    params: AutomationList,
    handler: pureUnavailable
  }),
  defineMethod({
    name: 'automation.show',
    permission: 'workspace',
    params: AutomationId,
    handler: pureUnavailable
  }),
  defineMethod({
    name: 'automation.create',
    permission: 'workspace',
    params: AutomationCreate,
    handler: pureUnavailable
  }),
  defineMethod({
    name: 'automation.update',
    permission: 'workspace',
    params: AutomationUpdate,
    handler: pureUnavailable
  }),
  defineMethod({
    name: 'automation.delete',
    permission: 'workspace',
    params: AutomationId,
    handler: pureUnavailable
  }),
  defineMethod({
    name: 'automation.runNow',
    permission: 'workspace',
    params: AutomationId,
    handler: pureUnavailable
  }),
  defineMethod({
    name: 'automation.runs',
    permission: 'workspace',
    params: AutomationRuns,
    handler: pureUnavailable
  })
]
