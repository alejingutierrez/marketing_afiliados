# Despliegue, operaciones y soporte continuo

## 1. Estrategia de entornos y release
- **Entornos**
  - `dev`: entorno local/productivo de developers. Ejecución vía `docker compose -f infrastructure/compose/docker-compose.yml up -d` + hot reload.
  - `qa` / `staging`: replicas controladas para validación. Fuente de datos poblada con `pnpm seed:qa`. Todas las ramas `release/*` se despliegan automáticamente aquí.
  - `prod`: entorno cliente. Solo recibe tags `vX.Y.Z` firmados desde `main`.
- **Naming convención**
  - Ramas largas: `feature/*`, `fix/*`, `hotfix/*`, `chore/*`.
  - `develop` (branch colaborativa) → `release/*` → `main`.
- **Pipeline estándar**
  1. `pnpm install`.
  2. `pnpm test` (lint + unit/integration + worker tests + validación docs).
  3. (Opcional por ahora) `pnpm test:e2e` contra entorno efímero.
  4. Construcción de imágenes Docker (`apps/api`, `apps/web`, `apps/worker`) y publicación en registry `registry.medipiel.co/marketing-afiliados/*` versionadas con tag del commit.
  5. Deploy orquestado (Compose para QA, Kubernetes/ECS futuro para prod) utilizando variables definidas en sección siguiente.

## 2. Configuración y orquestación
- **Variables comunes**: `.env.shared` centraliza configuración; replicar en gestor de secretos.
  - `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `MAIL_*`, `DATA_ENCRYPTION_KEY`, `VTEX_*`, `METRICS_API_KEY`.
- **API (`apps/api/.env`)**
  - `PORT`, `API_LOG_LEVEL`, `MAIL_TRANSPORT` (`smtp` en QA/PROD), `MAIL_ALERT_*`.
- **Web (`apps/web/.env`)**: `NEXT_PUBLIC_API_BASE_URL` + feature flags (`NEXT_PUBLIC_FEATURE_*`).
- **Worker (`apps/worker/.env`)**: `WORKER_CONCURRENCY`, `BACKUP_INTERVAL_MS`, `WORKER_METRICS_PORT`.
- **Docker Compose**
  - Dev stack: `docker compose -f infrastructure/compose/docker-compose.yml up -d` (monta api/web/worker + postgres/redis/mailhog/prometheus/grafana).
  - Producción: agregar archivo `docker-compose.prod.yml` (ver sección infra) que ejecuta `pnpm --filter ... run start` y no monta volúmenes locales.
- **Deploy automático**
  - QA: `docker compose -f ... -p marketing-afiliados-qa up -d --build`.
  - Prod: orquestación recomendada en Kubernetes/ECS con secrets gestionados (KMS/Parameter Store) y pipelines GitHub Actions + ArgoCD.

## 3. Infraestructura complementaria
- **Monitoring**
  - Prometheus scrappea `/api/v1/metrics` y `/metrics` del worker (puerto 9465).
  - Grafana dashboards: `monitoring/grafana` (importar a instancia gestionada en prod).
- **Backups**
  - PostgreSQL: snapshots diarios + retención 30/90/365 días.
  - Redis: AOF habilitado solo en prod.
  - Worker ejecuta `createBackupSnapshot` cada 15min (configurable).
- **Logs**
  - Pino (API) + stdout aggregator (Datadog/CloudWatch). Log format JSON.
- **Secret rotation**
  - JWT y `DATA_ENCRYPTION_KEY` rotados trimestralmente. Worker guarda claves activas en KMS/Secrets Manager.

## 4. Smoke tests post-deploy
_Ejecutar en QA y PROD después de cada release._
1. `GET /api/v1/health` responde 200.
2. Login con usuario `admin.qa@medipiel.co` (QA) -> código 2FA -> recibir JWT.
3. `GET /api/v1/dashboard/admin` retorna métricas y `topInfluencers` > 0.
4. Registrar influencer dummy vía `/api/v1/public/influencers` -> estado `pending`.
5. Ejecutar `POST /api/v1/commissions/settlements/run` con payload de prueba -> respuesta `200`.
6. Enviar solicitud de retiro desde dashboard QA (Frontend) -> aparece en `GET /api/v1/payments/withdrawals`.
7. Verificar alertas en Grafana (panel “marketing-observability”) sin fallos.

## 5. Runbooks de soporte
- **Webhook VTEX fallido**
  - Revisar `notifications` (API) + logs en Prometheus (`marketing_afiliados_webhook_events_total{success="false"}`).
  - Reintentar con `POST /api/v1/vtex/codes/:id/sync` o re-procesar payload almacenado en tabla `webhook_delivery_log`.
- **Reversas manuales**
  - Cambiar estado comisión vía `commission.runSettlement` con `waitingPeriodDays=0` + registrar ajuste en `payments/adjustments`.
  - Comunicar a Finance y actualizar saldo en `influencer_balance`.
- **Caída de email**
  - Revisar `/api/v1/notifications/emails` (outbox). Si `delivered=false`, validar SMTP en Mailhog/SES. Escalar a ops si >30 min.
- **Fallas de worker**
  - Monitorear `/metrics` -> `marketing_afiliados_worker_backup_runs_total`. Reiniciar contenedor; revisar logs Pino.
- **DB o Redis degradados**
  - Restaurar desde backup más reciente (QA: manual, PROD: runbook DBA). Notificar a stakeholders.

## 6. Retroalimentación post-MVP
- Enviar encuesta trimestral a roles clave (Admin Dentsu, Admin Marca, Gestor, Finance, Auditor, influencers piloto).
- Canalizar insights en board `post-mvp-roadmap` (Notion/Jira) priorizando automatización fiscal, dashboards avanzados y nuevas integraciones (ERP, CRM).
- Reunión de retro con negocio cada 6 semanas para actualizar backlog.

## 7. Mejora continua y gobernanza
- Reunión semanal de release: revisar estado QA, issues abiertos, checklist de smoke tests.
- Mantener changelog semántico (`CHANGELOG.md`) y versionado SemVer.
- Uso obligatorio de PR templates + revisión cruzada + validación `pnpm test` antes de merge.
- Métricas de flujo: lead time, MTTR, ratio de despliegues con incidentes.
- Auditoría semestral de accesos (RBAC) y rotación de secretos según política.
