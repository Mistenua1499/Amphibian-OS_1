# Migrar a Postgres (solo si algún día lo necesitas)

**Probablemente nunca lo necesites.** SQLite aguanta millones de filas y este es un sistema de UN usuario, local-first. Razones válidas para migrar: varios usuarios concurrentes escribiendo, o deploy en plataforma sin volumen persistente.

## Ruta recomendada
1. La capa de datos está aislada en `server/src/db.ts` (única fuente de SQL). En `docs/reference-postgres-schema.prisma` está el modelo de datos equivalente listo para Prisma+Postgres.
2. Prompt para Sonnet:
   ```
   Migra server/src/db.ts de node:sqlite a Postgres usando el paquete "pg".
   Mantén EXACTAMENTE las mismas funciones exportadas (Entities, Opps, Captures,
   Journal, Health, Finances, Reminders, SyncLogs, Settings, Timeline) con las
   mismas firmas — el resto del código no debe cambiar ni una línea.
   Usa docs/reference-postgres-schema.prisma como referencia del modelo.
   Cambios de SQL: INTEGER booleans → BOOLEAN, TEXT dates → TIMESTAMPTZ,
   ? placeholders → $1/$2..., y las funciones se vuelven async.
   Al terminar corre bash scripts/smoke.sh.
   ```
3. Exportar datos existentes: `sqlite3 server/amphibian.db .dump > backup.sql` y adapta los INSERT.
