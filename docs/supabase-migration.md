# Migración a Supabase

buglens pasa a pensar la colaboración como una fuente compartida en Supabase
(Postgres + Auth + Realtime + RLS), sin abandonar el modelo local de golpe.

## Decisión

- **DB base**: PostgreSQL.
- **Proveedor inicial**: Supabase hosted.
- **Motivo**: da Postgres real, Auth, RLS y Realtime sin operar infraestructura propia.
- **Auth**: Google OAuth vía Supabase Auth.
- **Modelo inicial**: un proyecto compartido por defecto. La DB ya soporta múltiples
  proyectos, pero la primera UI no necesita exponerlo.
- **No usar MCP para colaboración**: MCP queda reservado para una posible investigación de
  código por bug; la sincronización de equipo vive en la DB.

## Modelo de datos

La migración inicial está en:

```text
supabase/migrations/0001_initial_team_schema.sql
supabase/migrations/0002_default_project_rpc.sql
supabase/migrations/0003_bug_status_rpc.sql
supabase/migrations/0004_analysis_persistence_rpc.sql
```

La idea central es separar:

- `bugs`: bug lógico compartido del equipo. Se deduplica por `project_id + content_key`.
- `bug_occurrences`: apariciones de ese bug en un Excel o carga manual. Conserva la fila
  cruda y el origen.
- `bug_analysis_runs`: cada análisis realizado. No se pierde histórico si cambia el modelo,
  prompt o entrada.
- `bug_events`: auditoría de acciones relevantes.
- `bug_comments`: colaboración humana sobre el bug.

Esto evita que un reimport de Excel cree duplicados de estado, pero conserva evidencia de
cada fila importada.

## Seguridad

Todas las tablas compartidas tienen RLS habilitado. El acceso se controla por membresía de
proyecto:

- `owner` / `admin`: administración del proyecto y miembros.
- `editor`: importar, analizar y cambiar bugs.
- `viewer`: lectura.

La app cliente nunca debería usar una service key. Electron debe operar con sesión de usuario
normal de Supabase Auth.

## Datos grandes

Postgres guarda metadata y JSON estructurado. Las imágenes/capturas grandes no deberían vivir
como base64 en tablas para uso diario. Cuando pasemos a persistencia remota, las capturas de
Google Docs deberían ir a Supabase Storage y la DB guardar referencias.

## Fases propuestas

1. Crear proyecto Supabase y correr la migración SQL.
2. Agregar variables de entorno/configuración:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_DEFAULT_PROJECT_SLUG`
   - `SUPABASE_DEFAULT_PROJECT_NAME`
   - `SUPABASE_ACTIVE_PROJECT_ID` (opcional; normalmente lo guarda la UI)
3. Crear un adapter de datos detrás de una interfaz (`BugRepository`) para no acoplar toda la
   app al SDK de Supabase.
4. Agregar login con Google Auth y creación/selección del proyecto compartido por defecto.
5. Migrar estados a Supabase:
   - cambio de estado actualiza `bugs.status` y agrega `bug_events`.
6. Migrar bugs/análisis completos a Supabase:
   - importación crea `bug_imports`, `bugs`, `bug_occurrences`, `bug_analysis_runs`.
7. Agregar refresh/realtime entre usuarios.
8. Mantener modo local como fallback hasta que el flujo remoto sea estable.

## Pendientes antes de conectar la UI

- Definir cómo nombrar/crear el proyecto compartido por defecto.
- Decidir si se usa Supabase Realtime desde renderer o desde main.
- Definir retención de `bug_analysis_runs` si crece mucho.
