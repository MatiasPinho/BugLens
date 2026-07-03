import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalyzedBug, BugStatus } from '../../../shared/contracts/bugTypes.js'
import {
  addRemoteBugComment,
  deleteRemoteBug,
  loadRemoteAnalyzedBugs,
  setRemoteBugStatus,
} from '../../projects/infrastructure/teamBugs.js'
import type { SupabaseTeamConfig } from '../../projects/infrastructure/teamClient.js'

export function loadProjectBugs(client: SupabaseClient, config: SupabaseTeamConfig) {
  return loadRemoteAnalyzedBugs(client, config)
}

export function setBugStatus(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  bug: AnalyzedBug,
  status: BugStatus,
) {
  return setRemoteBugStatus(client, config, bug.enriched.raw, status)
}

export function deleteBug(client: SupabaseClient, config: SupabaseTeamConfig, bug: AnalyzedBug) {
  return deleteRemoteBug(client, config, bug.enriched.raw)
}

export function addBugComment(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  bug: AnalyzedBug,
  body: string,
) {
  return addRemoteBugComment(client, config, bug.enriched.raw, body)
}
