import type React from 'react'
import { useCallback, useState } from 'react'
import { IconUpload } from './icons'
import { col } from '../theme'

interface Props {
  excelPath: string | null
  onFileSelected: (path: string) => void
  disabled?: boolean
}

const ACCEPTED_EXTENSIONS = ['xlsx', 'xls', 'csv']

export default function FileUpload({ excelPath, onFileSelected, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return

      const file = e.dataTransfer.files[0]
      if (!file) return

      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!ACCEPTED_EXTENSIONS.includes(extension ?? '')) {
        setError('Solo se aceptan archivos .xlsx, .xls o .csv')
        return
      }

      const path = (file as { path?: string }).path
      if (path) {
        setError('')
        onFileSelected(path)
      } else {
        setError('No se pudo obtener la ruta del archivo. Elegilo con el botón.')
      }
    },
    [disabled, onFileSelected],
  )

  const handleBrowse = useCallback(async () => {
    if (disabled) return
    const path = await window.electronAPI.openExcelDialog()
    if (path) {
      setError('')
      onFileSelected(path)
    }
  }, [disabled, onFileSelected])

  const fileName = excelPath ? excelPath.split(/[\\/]/).pop() : null

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={disabled}
        aria-label={
          excelPath
            ? `Archivo cargado: ${fileName}. Activar para cambiarlo`
            : 'Arrastrá el Excel o hacé click para elegirlo'
        }
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => void handleBrowse()}
        className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
        style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      >
        <span className="dropzone-icon" aria-hidden="true">
          <IconUpload size={24} className="button-icon" />
        </span>
        {excelPath ? (
          <>
            <span className="mono font-semibold text-md">{fileName}</span>
            <span className="text-xs" style={{ color: col.fgDim }}>
              Click para cambiar el archivo
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-md">
              Arrastrá el Excel o hacé click para elegirlo
            </span>
            <span className="mono text-2xs" style={{ color: col.fgDim }}>
              .xlsx · .xls · .csv
            </span>
          </>
        )}
      </button>

      {error && (
        <p role="alert" className="text-xs" style={{ color: col.critical }}>
          {error}
        </p>
      )}
    </div>
  )
}
