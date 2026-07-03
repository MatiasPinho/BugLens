import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPersistentSupabaseClient, SupabaseFileStorage } from './teamSupabaseClient.js'

const tempDirs: string[] = []

function makeSessionPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-supabase-session-'))
  tempDirs.push(dir)
  return path.join(dir, 'session.json')
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('createPersistentSupabaseClient', () => {
  it('no crea cliente si falta URL o publishable key', () => {
    expect(
      createPersistentSupabaseClient({ url: '', publishableKey: 'pk' }, makeSessionPath()),
    ).toBeNull()
    expect(
      createPersistentSupabaseClient(
        { url: 'https://example.supabase.co', publishableKey: '' },
        makeSessionPath(),
      ),
    ).toBeNull()
  })

  it('lee sesiones legacy y persiste el formato nuevo por storage key', () => {
    const sessionPath = makeSessionPath()
    fs.writeFileSync(sessionPath, 'legacy-token', 'utf8')

    const storage = new SupabaseFileStorage(sessionPath)

    expect(storage.getItem('buglens-supabase-auth')).toBe('legacy-token')
    storage.setItem('buglens-supabase-auth', 'next-token')
    const saved = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as Record<string, string>
    expect(saved['buglens-supabase-auth']).toBe('next-token')
  })
})
