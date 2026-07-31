import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from './channels.js'

describe('IPC_CHANNELS', () => {
  it('mantiene nombres de canal únicos', () => {
    const values = Object.values(IPC_CHANNELS)

    expect(new Set(values).size).toBe(values.length)
  })

  it('conserva canales públicos usados por preload y main', () => {
    expect(IPC_CHANNELS.analyzeRun).toBe('analyze:run')
    expect(IPC_CHANNELS.analyzeManualBug).toBe('analyze:manual-bug')
    expect(IPC_CHANNELS.bugSetStatus).toBe('bug:set-status')
    expect(IPC_CHANNELS.bugsLoadRemote).toBe('bugs:load-remote')
    expect(IPC_CHANNELS.settingsGet).toBe('settings:get')
    expect(IPC_CHANNELS.exportFullData).toBe('export:full-data')
    expect(IPC_CHANNELS.bugSetAssignees).toBe('bug:set-assignees')
    expect(IPC_CHANNELS.bugSetDueDate).toBe('bug:set-due-date')
    expect(IPC_CHANNELS.bugVoteComment).toBe('bug:vote-comment')
    expect(IPC_CHANNELS.projectMembers).toBe('project:members')
  })
})
