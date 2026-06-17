// Íconos funcionales line-art (un trazo, `currentColor`), tamaño en la escala de 4px
// (8/12/16/20/24). Decorativos por defecto (`aria-hidden`): el significado lo da el
// texto que los acompaña. Para un ícono con semántica propia, pasar `title`.

interface IconProps {
  size?: number
  className?: string
  title?: string
}

function base(title?: string) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': title ? undefined : true,
    role: title ? ('img' as const) : undefined,
  }
}

export function IconCheck({ size = 16, className, title }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(title)}>
      {title && <title>{title}</title>}
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function IconWarning({ size = 16, className, title }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(title)}>
      {title && <title>{title}</title>}
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export function IconInfo({ size = 16, className, title }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base(title)}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  )
}
