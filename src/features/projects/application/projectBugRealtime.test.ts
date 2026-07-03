import { describe, expect, it, vi } from 'vitest'
import { ProjectBugRealtimeWatcher } from './projectBugRealtime.js'

function makeRealtimeClient() {
  const handlers: Array<{ table: string; callback: () => void }> = []
  let subscribedStatus: ((status: string) => void) | undefined
  const channel = {
    on: vi.fn((_event, filter, callback) => {
      handlers.push({ table: filter.table, callback })
      return channel
    }),
    subscribe: vi.fn((callback) => {
      subscribedStatus = callback
      return channel
    }),
  }
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  }
  return { client, channel, handlers, emitStatus: (status: string) => subscribedStatus?.(status) }
}

describe('ProjectBugRealtimeWatcher', () => {
  it('escucha cambios de bugs, comentarios y corridas del proyecto activo', async () => {
    const onChanged = vi.fn()
    const onStatus = vi.fn()
    const { client, handlers, emitStatus } = makeRealtimeClient()
    const watcher = new ProjectBugRealtimeWatcher({ onChanged, onStatus })

    await watcher.watch(client as never, 'project-1')

    expect(client.channel).toHaveBeenCalledWith('project-bugs:project-1')
    expect(handlers.map((handler) => handler.table)).toEqual([
      'bugs',
      'bug_comments',
      'bug_analysis_runs',
    ])

    handlers[0]?.callback()
    emitStatus('SUBSCRIBED')

    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(onStatus).toHaveBeenCalledWith('SUBSCRIBED')
  })

  it('no crea otro canal si el proyecto ya estÃ¡ observado', async () => {
    const { client } = makeRealtimeClient()
    const watcher = new ProjectBugRealtimeWatcher({ onChanged: vi.fn() })

    await watcher.watch(client as never, 'project-1')
    await watcher.watch(client as never, 'project-1')

    expect(client.channel).toHaveBeenCalledTimes(1)
  })

  it('remueve el canal activo al dejar de observar', async () => {
    const { client, channel } = makeRealtimeClient()
    const watcher = new ProjectBugRealtimeWatcher({ onChanged: vi.fn() })

    await watcher.watch(client as never, 'project-1')
    await watcher.unwatch(client as never)

    expect(client.removeChannel).toHaveBeenCalledWith(channel)
  })
})
