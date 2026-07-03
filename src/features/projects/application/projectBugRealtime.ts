import type { SupabaseClient } from '@supabase/supabase-js'

const WATCHED_PROJECT_TABLES = ['bugs', 'bug_comments', 'bug_analysis_runs'] as const

type RealtimeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | string
type ProjectBugChannel = ReturnType<SupabaseClient['channel']>

interface ProjectBugRealtimeEvents {
  onChanged: () => void
  onStatus?: (status: RealtimeStatus) => void
}

export class ProjectBugRealtimeWatcher {
  private channel: ProjectBugChannel | null = null
  private projectId: string | null = null

  constructor(private readonly events: ProjectBugRealtimeEvents) {}

  async watch(client: SupabaseClient | null, projectId: string): Promise<void> {
    if (this.projectId === projectId && this.channel) return
    if (!client) throw new Error('Supabase no estÃ¡ configurado.')

    await this.unwatch(client)

    let channel = client.channel(`project-bugs:${projectId}`)
    for (const table of WATCHED_PROJECT_TABLES) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `project_id=eq.${projectId}`,
        },
        this.events.onChanged,
      )
    }

    this.channel = channel.subscribe((status) => {
      this.events.onStatus?.(status)
    })
    this.projectId = projectId
  }

  async unwatch(client: SupabaseClient | null): Promise<void> {
    if (!this.channel) return
    if (client) await client.removeChannel(this.channel)
    this.channel = null
    this.projectId = null
  }
}
