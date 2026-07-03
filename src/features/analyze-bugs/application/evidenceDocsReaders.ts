import * as path from 'node:path'
import type { AppSettings } from '../../settings/application/settingsStore.js'
import { BrowserDocsReader } from '../infrastructure/browserDocsReader.js'
import { GoogleDocsReader } from '../infrastructure/googleDocsReader.js'

const GOOGLE_TOKEN_FILE = 'google-token.json'

export function googleTokenPath(userDataPath: string): string {
  return path.join(userDataPath, GOOGLE_TOKEN_FILE)
}

export function createGoogleDocsReader(
  settings: Pick<AppSettings, 'googleClientId' | 'googleClientSecret'>,
  userDataPath: string,
): GoogleDocsReader {
  return new GoogleDocsReader(
    settings.googleClientId,
    settings.googleClientSecret,
    googleTokenPath(userDataPath),
  )
}

export function createBrowserDocsReader(userDataPath: string): BrowserDocsReader {
  return new BrowserDocsReader(userDataPath)
}
