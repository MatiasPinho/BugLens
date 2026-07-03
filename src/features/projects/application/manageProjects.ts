import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSupabaseProject,
  createSupabaseTeamClient,
  getSupabaseTeamStatus,
  type SupabaseTeamConfig,
  type SupabaseTeamStatus,
  signOutSupabaseTeam,
  startSupabaseGoogleAuth,
} from '../infrastructure/teamClient.js'

export type { SupabaseTeamConfig, SupabaseTeamStatus }

export function createProjectClient(
  config: SupabaseTeamConfig,
  sessionPath: string,
): SupabaseClient | null {
  return createSupabaseTeamClient(config, sessionPath)
}

export function isProjectTeamConfigured(config: SupabaseTeamConfig): boolean {
  return Boolean(config.url && config.publishableKey)
}

export function projectTeamErrorStatus(
  config: SupabaseTeamConfig,
  error: string,
): SupabaseTeamStatus {
  return {
    configured: isProjectTeamConfigured(config),
    authenticated: false,
    error,
  }
}

export function loadProjectTeamStatus(
  client: SupabaseClient | null,
  config: SupabaseTeamConfig,
): Promise<SupabaseTeamStatus> {
  return getSupabaseTeamStatus(client, config)
}

export function startProjectTeamGoogleAuth(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  electronShell: { openExternal(url: string): Promise<void> },
): Promise<SupabaseTeamStatus> {
  return startSupabaseGoogleAuth(client, config, electronShell)
}

export function signOutProjectTeam(client: SupabaseClient | null): Promise<void> {
  return signOutSupabaseTeam(client)
}

export async function createProjectAndLoadStatus(
  client: SupabaseClient,
  config: SupabaseTeamConfig,
  name: string,
  slug: string,
): Promise<SupabaseTeamStatus> {
  const project = await createSupabaseProject(client, name, slug)
  return getSupabaseTeamStatus(client, { ...config, activeProjectId: project.id })
}
