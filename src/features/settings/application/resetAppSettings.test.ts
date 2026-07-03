import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resetAppSettings } from './resetAppSettings.js'

const tempDirs: string[] = []

function makeConfigPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-reset-'))
  tempDirs.push(dir)
  return path.join(dir, 'settings.json')
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('resetAppSettings', () => {
  it('borra settings cuando el scope es config', () => {
    const configPath = makeConfigPath()
    fs.writeFileSync(configPath, '{}')

    resetAppSettings('config', configPath)

    expect(fs.existsSync(configPath)).toBe(false)
  })

  it('no borra settings cuando el scope es bug-data', () => {
    const configPath = makeConfigPath()
    fs.writeFileSync(configPath, '{}')

    resetAppSettings('bug-data', configPath)

    expect(fs.existsSync(configPath)).toBe(true)
  })
})
