import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalyzedBug, BugStatus, CommentVote } from '../../../shared/contracts/bugTypes.js'
import {
  addRemoteBugComment,
  deleteRemoteBug,
  loadRemoteAnalyzedBugs,
  loadRemoteProjectMembers,
  setRemoteBugAssignees,
  setRemoteBugDueDate,
  setRemoteBugStatus,
  setRemoteCommentVote,
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
  parentId?: string | null,
) {
  return addRemoteBugComment(client, config, bug.enriched.raw, body, parentId)
}

export function setBugAssignees(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  bug: AnalyzedBug,
  userIds: string[],
) {
  return setRemoteBugAssignees(client, config, bug.enriched.raw, userIds)
}

export function setBugDueDate(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  bug: AnalyzedBug,
  dueDate: string | null,
) {
  return setRemoteBugDueDate(client, config, bug.enriched.raw, dueDate)
}

export function voteBugComment(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  commentId: string,
  value: CommentVote,
) {
  return setRemoteCommentVote(client, config, commentId, value)
}

export function listProjectMembers(client: SupabaseClient, config: SupabaseTeamConfig) {
  return loadRemoteProjectMembers(client, config)
}
