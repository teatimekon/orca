import { ipcMain } from 'electron'
import { HOSTED_SOURCE_CONTROL_ENABLED } from '../../../shared/pure-hosted-source-control'
import { whenHostedEnabled } from './hosted-source-control-gate'
import { appStarSourceSchema } from '../../../shared/gh-star-source'
import { resolveGhAccountRequiredHost } from '../../github/account-binding-required-host'
import { diagnoseGhAuth } from '../../github/auth-diagnose'
import { checkOrcaStarred, starOrca } from '../../github/client/fetch/orca-star'
import { getAuthenticatedViewer } from '../../github/client/fetch/authenticated-viewer'
import {
  listGhAccountBindingInventory,
  validateGhAccountBinding
} from '../../github/gh-account-binding-inventory'
import { getRateLimit } from '../../github/rate-limit'
import type { Store } from '../../persistence/loading-store/store'
import { getCohortAtEmit } from '../../telemetry/cohort-classifier'
import { track } from '../../telemetry/client'
import { assertRegisteredGitHubRepo, getGitHubLocalGitOptionArgs } from './github-repo-routing'

export function registerGitHubAccountHandlers(store: Store): void {
  ipcMain.handle(
    'gh:viewer',
    whenHostedEnabled(
      HOSTED_SOURCE_CONTROL_ENABLED,
      () => null,
      () => getAuthenticatedViewer()
    )
  )
  // Null makes Landing and Settings fall back to the plain web star link: no gh process.
  ipcMain.handle(
    'gh:checkOrcaStarred',
    whenHostedEnabled(
      HOSTED_SOURCE_CONTROL_ENABLED,
      () => null,
      () => checkOrcaStarred()
    )
  )
  ipcMain.handle('gh:starOrca', async (_event, source: unknown) => {
    if (!HOSTED_SOURCE_CONTROL_ENABLED) {
      return false
    }
    const sourceParse = appStarSourceSchema.safeParse(source)
    const starred = await starOrca()
    if (starred && sourceParse.success) {
      track('app_starred_orca', {
        source: sourceParse.data,
        ...getCohortAtEmit()
      })
    }
    return starred
  })

  ipcMain.handle('gh:rateLimit', (_event, args?: { force?: boolean }) =>
    getRateLimit(args?.force ? { force: true } : undefined)
  )

  ipcMain.handle('gh:diagnoseAuth', (_event, args?: { host?: string }) =>
    diagnoseGhAuth(args?.host)
  )

  ipcMain.handle(
    'gh:listBindableAccounts',
    async (_event, args: { repoPath: string; repoId?: string; refreshCapability?: boolean }) => {
      if (!HOSTED_SOURCE_CONTROL_ENABLED) {
        return { capability: 'unsupported' as const, accounts: [] }
      }
      const repo = assertRegisteredGitHubRepo(args, store)
      const localGitOptions = getGitHubLocalGitOptionArgs(store, repo)[0] ?? {}
      const requiredHost = await resolveGhAccountRequiredHost(repo, localGitOptions)
      return listGhAccountBindingInventory(localGitOptions, {
        refreshCapability: args.refreshCapability === true,
        ...(requiredHost ? { requiredHost } : {})
      })
    }
  )

  ipcMain.handle(
    'gh:validateAccountBinding',
    async (_event, args: { repoPath: string; repoId?: string; host: string; user: string }) => {
      if (!HOSTED_SOURCE_CONTROL_ENABLED) {
        return { ok: false as const, error: 'gh_multi_account_unsupported' as const }
      }
      const repo = assertRegisteredGitHubRepo(args, store)
      const localGitOptions = getGitHubLocalGitOptionArgs(store, repo)[0] ?? {}
      const requiredHost = await resolveGhAccountRequiredHost(repo, localGitOptions)
      return validateGhAccountBinding(
        { host: args.host, user: args.user },
        localGitOptions,
        requiredHost ? { requiredHost } : {}
      )
    }
  )
}
