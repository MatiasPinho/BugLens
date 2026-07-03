import { deleteFileIfExists } from '../../../platform/filesystem/jsonFileStore.js'

export type AppResetScope = 'bug-data' | 'config'

export function resetAppSettings(scope: AppResetScope, configPath: string): void {
  if (scope === 'config') {
    deleteFileIfExists(configPath)
  }
}
