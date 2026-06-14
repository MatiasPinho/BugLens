import type React from 'react'
import { useCallback, useState } from 'react'
import { alpha, col } from '../theme'

interface Props {
  excelPath: string | null
  onFileSelected: (path: string) => void
  disabled?: boolean
}

export default function FileUpload({ excelPath, onFileSelected, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return

      const file = e.dataTransfer.files[0]
      if (!file) return

      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
        alert('Solo se aceptan archivos .xlsx, .xls o .csv')
        return
      }

      const path = (file as { path?: string }).path
      if (path) {
        onFileSelected(path)
      } else {
        alert('No se pudo obtener el path del archivo.')
      }
    },
    [disabled, onFileSelected],
  )

  const handleBrowse = useCallback(async () => {
    if (disabled) return
    const path = await window.electronAPI.openExcelDialog()
    if (path) onFileSelected(path)
  }, [disabled, onFileSelected])

  const fileName = excelPath ? excelPath.split(/[\\/]/).pop() : null

  return (
    <div className="card">
      <div className="label mb-2">archivo de entrada</div>

      <button
        type="button"
        disabled={disabled}
        aria-label={
          excelPath
            ? `Archivo cargado: ${fileName}. Activar para cambiar`
            : 'Seleccionar archivo Excel'
        }
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => {
          if (!disabled) handleBrowse()
        }}
        className="block w-full select-none rounded-md text-center transition-all"
        style={{
          padding: excelPath ? '0.75rem 1rem' : '1.5rem 1rem',
          border: `1px dashed ${dragOver ? alpha(col.cream, 0.55) : excelPath ? alpha(col.fgDim, 0.38) : alpha(col.border, 0.32)}`,
          background: dragOver
            ? alpha(col.cream, 0.04)
            : excelPath
              ? alpha(col.fgDim, 0.03)
              : 'transparent',
          opacity: disabled ? 0.3 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {excelPath ? (
          <div className="flex items-center gap-2.5">
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: col.fgDim, flexShrink: 0 }}
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="14 2 14 8 20 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="16"
                y1="13"
                x2="8"
                y2="13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="16"
                y1="17"
                x2="8"
                y2="17"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <polyline
                points="10 9 9 9 8 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate font-mono text-xs" style={{ color: col.fg }}>
                {fileName}
              </div>
              <div className="mt-0.5 font-mono text-xs" style={{ color: col.border }}>
                click para cambiar
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: dragOver ? col.fgDim : col.muted, transition: 'color 0.15s' }}
            >
              <path
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="17 8 12 3 7 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="12"
                y1="3"
                x2="12"
                y2="15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <div
                className="font-mono text-xs"
                style={{ color: dragOver ? col.fgDim : col.border }}
              >
                arrastrar o click para seleccionar
              </div>
              <div className="mt-1 font-mono text-xs" style={{ color: col.dim }}>
                .xlsx · .xls · .csv
              </div>
            </div>
          </div>
        )}
      </button>
    </div>
  )
}
