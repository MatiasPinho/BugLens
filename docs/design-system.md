# Sistema de diseño de BugLens

Este documento define la dirección visual y de interacción de BugLens. El artefacto
`BugLens Design System.dc.html` fija la intención del producto; la implementación
canónica vive en `renderer/styles.css`, `renderer/theme.ts`, `tailwind.config.ts` y
las historias de Storybook.

`support.js` forma parte del runtime generado por la herramienta de diseño. No es una
dependencia de BugLens ni una fuente de tokens o componentes.

## Principios

- **Claro y aireado:** base blanca continua, bordes suaves y sombras mínimas.
- **Consola editorial de QA:** la interfaz combina la precisión de una herramienta
  operativa con una jerarquía visual cuidada; el contenido y el estado del bug dominan,
  no la decoración.
- **Azul como acento:** se reserva para acciones principales, selección, progreso,
  foco y marca.
- **Denso pero legible:** la aplicación maneja muchos reportes; la densidad se resuelve
  con jerarquía, agrupación y una escala tipográfica compacta, no reduciendo el contraste.
- **Navegación estable:** el shell usa un rail de iconos, un topbar con el contexto
  global y un área de trabajo continua.
- **Detalle siempre a la vista:** un bug se lee y gestiona en la columna central de la
  pantalla de Bugs, sin cambiar de pantalla.
- **Semántica visible:** severidad, estado y datos faltantes se comunican con texto,
  color y forma.

## Fundaciones

### Color

Los valores viven como canales RGB en `renderer/styles.css :root`. Los componentes no
deben hardcodear colores: usan `col`, `alpha`, clases semánticas o `var(--c-*)`.

| Familia | Tokens principales | Uso |
|---|---|---|
| Superficies | `canvas`, `chrome`, `surface`, `subtle`, `sunken`, `chip` | Fondo, navegación, contenido, bloques anidados, hover y chips |
| Acento | `accent`, `accent-hover`, `accent-bright`, `accent-pale`, `accent-soft`, `accent-line` | CTA, foco, progreso y selección |
| Texto | `fg`, `fg-strong`, `fg-body`, `fg-muted`, `fg-dim` | Jerarquía de títulos, cuerpo y metadata |
| Bordes | `border-strong`, `border`, `border-card`, `border-soft`, `border-faint` | Controles, tarjetas y divisores |
| Severidad | `critical`, `high`, `medium` con variantes `-bg` y `-line` | Badges y alertas de severidad |
| Workflow | `status-new`, `progress`, `solved`, `not-repro` con variantes semánticas | Estado del bug |
| Advertencia | `warn`, `warn-bg`, `warn-line`, `warn-solid` | Datos que faltan y avisos |
| Código | `code`, `code-bg`, `code-line` | Literales técnicos dentro del texto |
| Avatares | `avatar-1` … `avatar-6` | Identidad de las personas |
| Voto | `vote-up`, `vote-down` | Reacción a comentarios |

Valores de referencia:

- Canvas, chrome y superficie `#ffffff`; anidado `#f6f8fb`.
- Bordes de controles `#c5cdda`, tarjetas `#cfd6e1` y divisores internos `#e4e9f0`.
- Acento `#2563eb`, hover `#1d4ed8`, tint `#eff6ff`.
- Texto principal `#101828`, cuerpo `#475467`, secundario `#545e72`.

**Una base blanca continua.** Canvas, navegación —rail, topbar y columna de lista— y
contenido comparten el blanco. Los bordes, el espaciado y la forma separan esas áreas;
`subtle` queda reservado para bloques anidados y estados funcionales, no para crear pisos
grises en la aplicación.

`fg-dim` es el gris más claro permitido para texto: mantiene 4.5:1 (WCAG AA) sobre la base
blanca. `fg-faint` y `fg-disabled` quedan para decoración y estados inactivos, nunca para
texto informativo.

Los badges semánticos conservan estas asociaciones:

| Señal | Texto | Fondo | Borde |
|---|---:|---:|---:|
| Crítica | `#b42318` | `#fef3f2` | `#fecdca` |
| Alta | `#c4320a` | `#fff4ed` | `#ffd6ae` |
| Media | `#a15c07` | `#fffaeb` | `#fde68a` |
| Nuevo | `#0e7490` | `#ecfeff` | `#a5f3fc` |
| En progreso | `#5925dc` | `#f4f3ff` | `#d9d6fe` |
| Solucionado | `#067647` | `#ecfdf3` | `#abefc6` |
| Cerrado | `#475467` | `#f9fafb` | `#eaecf0` |
| No replicado | `#c11574` | `#fdf2fa` | `#fcceee` |

`nuevo` es cian y no azul: con el acento en azul, un badge de estado azul se leería
como una acción. El resto de la familia de workflow no cambió.

### Identidad de las personas

Los avatares no eligen su color: `avatarToneOf` (en `renderer/components/avatarTone.ts`)
deriva el tono del id del perfil, de modo que una misma persona conserva su color en
la lista, el detalle, los comentarios y el topbar. `initialsOf` prioriza el nombre
visible y cae a la parte local del email. Los tonos son de **identidad**, nunca
semánticos: no comunican estado ni severidad.

Los grupos de personas usan `.avatar-row`, que **no** superpone los avatares. El stack
superpuesto es un patrón pensado para fotos; con iniciales de dos letras cada avatar tapa
las del anterior y el grupo se vuelve ilegible.

### Código dentro del texto

`.code-chip` marca endpoints, nombres de error y rutas **dentro de un párrafo**, a ras
del texto y sin romper el interlineado. `.code-inline` sigue siendo el bloque de una
línea con caja propia, y `.code-block` el bloque multilínea.

### Tipografía

- **Public Sans** es la tipografía de producto. Está vendorizada en
  `renderer/assets/fonts/public-sans/` para que Electron no dependa de una CDN.
- **Iosevka Nerd Font Mono** se limita a código, rutas, keys y timestamps.
- La escala va de `--text-3xs` a `--text-5xl` (10, 11, 12, 13, 14, 15, 16,
  18, 20, 22 y 24 px).
- El cuerpo base usa 13 px con `line-height: 1.6`. Los pesos habituales son
  500 para énfasis medio, 600 para controles y subtítulos, y 700 para títulos.
- Las VERSALES se reservan para kickers y micro-labels; no se usan en textos
  largos ni acciones principales.
- **Mayúscula inicial en todo lo que se lee como rótulo**: títulos de pantalla, de
  panel, de sección, de modal y etiquetas de botón. Los modales venían en minúscula
  ("nuevo proyecto", "borrar bug") y quedaban como una excepción sin motivo dentro de
  una app que capitaliza el resto.

### Forma, controles y profundidad

- Radios: 5/6 px para microelementos, 8 px para controles, 10/12 px para tarjetas,
  14 px para modales y 16 px para los paneles del shell y las capturas embebidas.
  `--radius-pill` queda para pills, avatares y contadores de voto.
- Alturas: 24 px para teclas/pasos, 30 px para microcontroles, 34 px para controles
  estándar y 38 px para CTA o buscadores principales.
- Sombras: `shadow-card` para separación mínima, `shadow-panel` para paneles de trabajo,
  `shadow-float` para los paneles del shell de tres columnas, `shadow-card-hover` para
  elevación interactiva, `shadow-pop` para elementos flotantes, `shadow-modal` para
  modales y `shadow-accent` para acciones del acento.
- La profundidad se usa para distinguir niveles de trabajo: canvas, panel, tarjeta
  interactiva y modal. No se agregan sombras decorativas sin una relación jerárquica.
- La grilla de spacing sigue la escala de Tailwind basada en 4 px.
- Los iconos usan 8, 12, 16, 20, 24 o 28 px.

### Marca de producto

La identidad principal es `BugLensMark`: una lente que contiene líneas de reporte
ordenadas. La silueta une las dos acciones centrales del producto —leer un bug y
convertirlo en información clara— sin recurrir al ícono genérico de un insecto.

- Sobre el cuadrado azul de marca se usa en blanco y sin animación.
- Hasta 24 px se usa la variante `compact`, con menos líneas y mayor peso de trazo.
- `build/icon.svg` es la fuente maestra para los íconos del sistema operativo;
  `build/icon.ico` y `build/icons/` contienen las variantes rasterizadas.
- Windows usa el mismo `.ico` como recurso del ejecutable y como ícono nativo de la
  ventana, junto con el `AppUserModelID` de BugLens para no agruparse como Electron.
- `BeetleMark` y `BugUnderLensMark` quedan como motivos ilustrativos secundarios para
  vacíos y fondos. No reemplazan la marca en el rail, el acceso ni el primer arranque.

## Shell y navegación

El shell de escritorio se compone de:

- **Rail de iconos de 56 px** con la marca arriba, los destinos de trabajo (Bugs, Cargar
  bugs, Proyectos), y abajo Configuración y la ayuda. Al no haber texto visible, cada
  botón lleva `aria-label` + `title`, y el contador se repite dentro del label porque un
  número suelto no dice de qué es. El destino activo usa fondo de acento **más** una barra
  al borde del rail: no depende solo del color.
- **Columna de lista** (296 px) en la pantalla de Bugs, hermana del rail y de altura
  completa: arranca en el borde superior de la ventana con el buscador arriba de todo.
  Es navegación, no contenido, y por eso el topbar **no la cruza**.
- **Topbar** con las migas de pan, el selector de proyecto, el estado del motor, las
  acciones de trabajo, el equipo y la identidad del usuario. Empieza a la derecha de la
  lista. Todo el contexto global vive acá, no en la navegación. En Electron también hace
  de barra de título: el área libre arrastra la ventana y reserva a la derecha los controles
  nativos. Cuando el shell no deja ancho suficiente, las acciones conservan su icono,
  `aria-label` y `title`, y ocultan sólo el rótulo visible. No se muestra un segundo título
  gris ni el menú “File / Edit / View”.
- **Área de contenido** sobre el canvas plano. No hay banda de encabezado de pantalla:
  el texto más grande es el título del bug que se está leyendo, en la columna central.

## Pantallas y correspondencia en el código

| Diseño | Comportamiento | Implementación |
|---|---|---|
| Bugs (tres columnas) | Lista + reporte + propiedades y actividad | `BugsScreen.tsx`, `BugList.tsx`, `BugDetail.tsx`, `BugComments.tsx`, `BugPropertiesRail.tsx` |
| Carga manual | Formulario modal de un bug | `ManualBugForm.tsx`, `ActionModal.tsx` |
| Carga por archivo | Vacío, dropzone y archivo seleccionado | `UploadBugsScreen.tsx`, `FileUpload.tsx`, `EmptyState.tsx` |
| Análisis en curso | Fases, progreso y log | `AnalysisProgressScreen.tsx`, `ProgressLog.tsx`, `Loading.tsx` |
| Proyectos | Selector, proyecto activo y estado vacío | `ProjectsScreen.tsx`, `ProjectSwitcher.tsx`, `NewProjectModal.tsx` |
| Configuración | Índice, equipo, modelo, rendimiento, Docs, agente y caché | `Settings.tsx`, `PerformanceModePicker.tsx` |
| Acceso al equipo | Identidad del producto e inicio de sesión | `TeamLogin.tsx` |
| Primer arranque | Wizard de rendimiento, modelo y Google Docs | `Onboarding.tsx` |

`ProjectsScreen.tsx`, `ProjectSwitcher.tsx` y `NewProjectModal.tsx` extienden el
mismo lenguaje para la gestión de proyectos.

### Selección en listas

La fila seleccionada usa un **gris azulado** (`--c-selected`) más una **barra de acento a la
izquierda**, que es el indicador principal. Un fondo con tint de acento competía con el
contenido de la propia fila y el título tenía que teñirse de azul para sobrevivir.

### Reporte como documento de trabajo

La reescritura se lee como una secuencia: **01 Qué pasa**, **02 Qué debería pasar** y
**03 Pasos para reproducir**. Los números son decorativos y la semántica sigue en los
títulos; el eje vertical de los pasos refuerza el orden sin convertir el reporte en un
wizard. El rail derecho agrupa seguimiento y contexto para evitar una lista plana de
propiedades inconexas.

### Acciones secundarias y destructivas

Lo destructivo y lo de consulta ocasional van detrás de `MenuButton`, no en la fila de
acciones: "Borrar" compitiendo con "Analizar con agente" le daba el mismo peso a algo que
se usa una vez cada tanto y a la acción de trabajo. Lo mismo con la identidad: mail,
proveedor, equipo y cierre de sesión viven detrás del avatar del topbar.

### Cuando el agente externo falla

El panel muestra siempre tres cosas: el motivo que da BugLens, **la salida cruda del agente**
y el comando ejecutado. La salida es lo único que explica *por qué* falló, así que no se
condiciona a que además exista un mensaje de error.

Si el agente terminó sin escribir nada, se dice explícitamente y se aclara que BugLens solo
puede mostrar lo que el comando manda a stdout o stderr — un agente que registra sus errores
en un log propio deja la causa fuera del alcance de la app.

### Bloques largos

`CollapsibleBlock` recorta el reporte reescrito y ofrece "Ver más" para que los comentarios
queden al alcance sin atravesar varias pantallas. El aporte externo usa una divulgación propia:
una corrida persistida y exitosa arranca plegada, mientras que el progreso en vivo y los errores
quedan abiertos. Así el análisis secundario no compite con el reporte de QA.

Tres reglas:

- **Solo se pliega si vale la pena.** El control aparece únicamente si lo que se oculta
  supera un mínimo (`shouldOfferCollapse`); un botón que esconde diez píxeles molesta más
  de lo que ayuda.
- **Se corta con un degradado, no a filo.** Un corte duro se confunde con el final del
  bloque.
- **Lo recortado queda `inert`.** Si no, sus botones seguirían siendo alcanzables con Tab
  y se llegaría a un control invisible.
- **El historial no ocupa la lectura principal.** Sus corridas quedan detrás de un resumen
  compacto y se consultan bajo demanda.

## Patrones de interacción

- **Bugs:** las tres columnas comparten el estado de filtros y el bug elegido. Si un
  filtro deja afuera al bug enfocado, se muestra el primero visible: la columna central
  nunca queda mostrando un reporte que la lista ya no ofrece. El encabezado ofrece un
  acceso directo a comentarios: desplaza el mismo hilo y mueve allí el foco, sin duplicar
  el composer ni separar la conversación del reporte.
- **Un control por cosa:** el estado se **cambia** en el rail de propiedades y se
  **muestra** como badge en la columna central. Las acciones destructivas siempre pasan
  por el modal compartido.
- **Estados:** el selector muestra texto y color. Los atajos 1–5 cambian el estado
  del bug enfocado.
- **Carga:** drag-and-drop y selector de archivo comparten feedback de validación.
  La carga manual conserva autofocus, trap de foco y envío con Ctrl/Cmd+Enter.
- **Progreso:** las fases deben exponer texto y `aria-current`; el log técnico usa
  monoespaciada solo donde aporta legibilidad.
- **Feedback:** loading, vacío, error y éxito mantienen el layout para evitar saltos.

## Accesibilidad y adaptación

- Todos los controles interactivos deben tener `focus-visible`.
- Los controles de solo icono requieren `aria-label`.
- Badges, estados y progreso nunca dependen únicamente del color.
- El orden de foco sigue el orden visual; tabs y selectores respetan sus patrones ARIA.
- `prefers-reduced-motion` neutraliza animaciones no esenciales.
- El texto informativo mantiene como mínimo contraste WCAG AA.
- El producto es desktop-first. Por debajo de 1180 px el rail de propiedades pasa a ser
  un panel superpuesto, accesible desde la barra compacta del reporte; por debajo de 860 px
  también se oculta la lista (navegación). El reporte y sus acciones nunca se van.

## Contrato de implementación

1. `renderer/styles.css :root` es el único origen de valores.
2. `renderer/theme.ts` expone referencias para estilos inline, sin duplicar valores.
3. `tailwind.config.ts` expone utilidades `bl-*` que apuntan a los mismos tokens.
4. Los badges de estado y severidad se construyen con las clases semánticas existentes.
5. `renderer/components/DesignSystem.stories.tsx` es la documentación visual viva
   (badges, controles, superficies, identidad y código en prosa).
   `renderer/components/AppShell.stories.tsx` valida el shell completo en contexto. Las
   pantallas de carga y proyectos mantienen historias propias para sus estados principales.
6. Los componentes nuevos no introducen una paleta, fuente o shell alternativos.
7. Una modificación de tokens debe verificarse en las historias de badges, controles,
   superficies y en la pantalla de Bugs completa.
8. Las clases de `@layer components` van escritas completas en el código: Tailwind purga
   del build las que arma una interpolación. Verificar con `grep` sobre el CSS compilado
   al agregar una familia dinámica.
