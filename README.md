# Plataforma de marketing de afiliados – Medipiel

## Objetivo del proyecto
Implementar una plataforma full JavaScript/TypeScript para gestionar el programa de marketing de afiliados de Medipiel: registro y aprobación de influencers, campañas por marca, sincronización de códigos con VTEX, tracking de pedidos y comisiones, flujos de pagos, conciliaciones y cumplimiento legal (Habeas Data).

## Estado de avance
- **Fase actual:** Fase 10 – QA, pruebas automatizadas y documentación (en progreso).
- **Entregables de la fase:** estrategia formal de pruebas (pirámide unit/integración/e2e), ampliación de suites automatizadas (NestJS + Vitest + Playwright), mocks compartidos para VTEX/email, portal OpenAPI versionado, datasets de seed para QA/staging y checklist de QA manual por roles.
- **Fases completadas:**
  - Fase 1 – Arquitectura técnica y diseño del repositorio.
  - Fase 2 – Gobernanza de datos y modelado de dominio.
  - Fase 3 – Cimientos del repositorio y tooling.
  - Fase 4 – Backend: foundation y módulos core.
  - Fase 5 – Integración VTEX y sincronización de códigos.
  - Fase 6 – Motor de comisiones y saldos.
  - Fase 7 – Pagos, retiros y soporte fiscal.
  - Fase 8 – Frontend React + Ant Design.

### Actualización fase 10 – QA, pruebas automatizadas y documentación
- Se formalizó el plan de QA en `docs/qa_plan.md` y el checklist operativo en `docs/qa_manual_checklist.md` para cubrir la pirámide de pruebas y tareas manuales por rol.
- Se añadieron nuevas suites automatizadas: unit tests sobre el `InMemoryDatabaseService`, pruebas de integración del módulo VTEX con mocks dedicados y cobertura del worker (`apps/worker/test`).
- Portal de documentación API expuesto en `/api/docs` (Nest + Swagger); el contrato se versiona en `docs/openapi.yaml` y `docs/openapi.json` para consultas offline.
- Dataset QA preparado en `prisma/seed-qa.ts` con flujo completo (tenant, campañas, pedido, comisión y retiro). Disponible mediante `pnpm seed:qa`.
- Se agregó el paquete `apps/e2e` con escenarios Playwright para registro público y dashboard administrativo; los tests están marcados con `test.describe.fixme` hasta estabilizar la ejecución headless (requiere habilitar el flujo Ant Design y seeds específicos).
- Próximos entregables: reactivar y endurecer los escenarios Playwright, extender contratos OpenAPI por módulo y automatizar exportes del dataset QA en pipelines.

### Actualización fase 9 – Observabilidad, seguridad y cumplimiento
- API y worker con telemetría OpenTelemetry, métricas Prometheus y registros enriquecidos con `traceId`; las pruebas e2e validan la exposición de `marketing_afiliados_api_request_duration_seconds` y el scraping seguro en `/api/v1/metrics`.
- Grafana actualizada incorpora paneles para latencia p95 de la API, throughput/errores de webhooks, colas BullMQ y discrepancias de conciliación (dashboard `marketing-observability`).
- Alerting centralizado: `EmailService` (nodemailer) con grupos configurables (`MAIL_ALERT_*`), transporte `memory` para test/local y SMTP (Mailhog) en docker; outbox auditable vía `GET /api/v1/notifications/emails` y métricas `marketing_afiliados_alerts_total`.
- Nuevos controles de seguridad: 2FA opcional para roles administrativos, política de contraseñas con validación y endpoint de rotación, rate limiting específico, cifrado en reposo de datos bancarios/documentos y backups automáticos desde el worker.
- Flujos legales reforzados: historial de consentimientos por influencer, constancias descargables y publicación versionada de políticas con notificaciones `policy.updated`.

### Actualización fase 8 – cumplimiento legal y UX
- Se añadió el módulo `PoliciesModule` en NestJS con endpoints públicos `GET /api/v1/public/policies` y `GET /api/v1/public/policies/:policyType`, respaldados por versiones sembradas para `terms`, `privacy` y `habeas_data`.
- El registro público ahora obliga a aceptar la política vigente: se obtiene la versión activa vía React Query, se calcula el `consentHash`, y se envía `policyVersionId` junto al `userAgent` del navegador.
- La interfaz bloquea el envío si no hay política activa, informa errores de carga y muestra metadatos (`fecha de publicación`, `checksum`) para auditoría rápida.
- Nuevas pruebas en `apps/web` cubren el hook `usePolicies` y el renderizado/estado del bloque legal en `RegisterPage`, garantizando que la actualización quede protegida por tests.

## Stack seleccionado (Fase 1)
- **Backend:** NestJS 10 (TypeScript) sobre Node.js 20 LTS.
- **Frontend:** Next.js 14 con React 18 y Ant Design 5.
- **Procesos asíncronos:** Worker Node.js con BullMQ.
- **Base de datos:** PostgreSQL 15 (principal) y Redis 7 para colas/cache.
- **Almacenamiento de archivos:** S3 compatible (MinIO en local, S3 en producción).
- **Testing recomendado:** Jest/Vitest (unidad e integración), Playwright/Cypress (E2E), Supertest para API.
- **Notificaciones:** SMTP (Mailhog local, SendGrid/SES en producción).

## Estructura del monorepo
Se trabajará con pnpm workspaces y estructura modular:
```
apps/
  api/        # Backend NestJS (REST + webhooks)
  web/        # Frontend Next.js + Ant Design
  worker/     # Servicios asíncronos (BullMQ)
packages/
  ui/         # Biblioteca de componentes compartidos
  vtex-client/# SDK para integraciones VTEX
  domain/     # Lógica de dominio reutilizable (cálculos, validaciones)
infrastructure/
  docker/     # Dockerfiles y scripts de build
  compose/    # Archivos docker-compose por entorno
scripts/       # Scripts utilitarios y validaciones
```
Documentación complementaria en `docs/` (arquitectura, modelo de datos, políticas, conciliación, seguridad).

## Estrategia de configuración y secretos
- Ficheros `.env` separados por aplicación (`apps/api/.env.local`, `apps/web/.env.local`, etc.) y un `.env.shared` con variables comunes.
- Variables sensibles gestionadas mediante gestor de secretos (AWS SSM Parameter Store/Vault).
- Convención de prefijos: `API_`, `WEB_`, `WORKER_`, `VTEX_`, `DB_`, `MAIL_`.
- Variables VTEX incluidas en `.env.shared` (`VTEX_ACCOUNT`, `VTEX_ENVIRONMENT`, `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `VTEX_BASE_URL`) con defaults de desarrollo y validación vía Joi.
- Variables de observabilidad y seguridad: `METRICS_API_KEY` (API), `WORKER_METRICS_PORT`, `BACKUP_INTERVAL_MS` (worker) y `DATA_ENCRYPTION_KEY` para cifrado en reposo; en producción se gestionan vía gestor de secretos con rotación.
- Alertas por correo: `MAIL_ENABLED`, `MAIL_TRANSPORT`, `MAIL_FROM`, `MAIL_ALERT_GLOBAL/FINANCE/OPERATIONS` y `MAIL_SMTP_*`; por defecto (local/test) se usa transporte `memory` (`apps/api/.env.local`, `.env.test`) y en docker-compose se apunta a Mailhog.
- Se documentará un árbol de configuración en `docs/seguridad_cumplimiento.md` y guías operativas en Fase 3.

## Herramientas y estándares
- **Gestor de paquetes:** pnpm 8 (`packageManager` definido en `package.json`).
- **Linting & formato:** ESLint + Prettier.
- **Tipos y build:** TypeScript 5.3+, SWC/ts-node para herramientas.
- **Convención de commits:** Conventional Commits.
- **CI/CD objetivo:** GitHub Actions (lint, test, build, docker push).

## Gobernanza de datos (Fase 2)
- **ORM:** Prisma 5.16 con `@prisma/client` generado desde `prisma/schema.prisma`.
- **Migraciones:** gestionadas con Prisma Migrate; migración inicial definida en `prisma/migrations/000_init/migration.sql` (requiere extensión `pgcrypto`).
- **Modelo lógico:** alineado a `docs/modelo_datos.md`, con constraints de unicidad e índices para consultas de conciliación y reporting.
- **Tipos monetarios:** uso de `Decimal` con precisión explicita (`@db.Decimal`) para totales, comisiones y saldos.
- **Seeds base:** creación automática de roles fundamentales dentro de la migración inicial.

## Cimientos del repositorio y tooling (Fase 3)
- **TypeScript compartido:** `tsconfig.base.json` y `tsconfig.json` definen paths comunes y reglas estrictas para `apps/` y `packages/`.
- **Calidad de código:** ESLint (`.eslintrc.cjs`) y Prettier (`.prettierrc`) integrados con scripts `pnpm lint`, `pnpm format`, `pnpm format:check` y pre-commit Husky/Lint-Staged.
- **Automatización:** workflow CI (`.github/workflows/ci.yml`) ejecuta `pnpm lint` y `pnpm test` en pushes/PRs hacia `main` y `develop`.
- **Dockerización local:** `apps/*/Dockerfile` y `infrastructure/compose/docker-compose.yml` levantan API, web, worker, PostgreSQL, Redis y Mailhog; variables compartidas en `.env.shared` y entornos locales por app.
- **Estructura monorepo:** `apps` y `packages` cuentan con `package.json` y `src/index` de placeholder para facilitar el scaffolding futuro.
- **Contribución:** plantillas en `.github/` y hooks Husky (`.husky/pre-commit`) aseguran consistencia en PRs e issues.

## Backend: foundation y módulos core (Fase 4)
- **NestJS API:** bootstrap en `apps/api/src/main.ts` con CORS, Helmet, prefix `/api/v1`, logging Pino y Throttler guard global.
- **Autenticación:** módulo `auth` con JWT access/refresh, usuarios seed con roles (`@marketing-afiliados/api`), guardias `JwtAuthGuard` y `RolesGuard` y decoradores `@Roles`/`@CurrentUser`.
- **Influencers & campañas:** módulos `influencers`, `campaigns` y `codes` con servicios in-memory basados en `InMemoryDatabaseService` (registro público, gestión de estados, asignaciones y generación de códigos).
- **Módulos auxiliares:** esqueleto operativo para `orders`, `commissions`, `payments`, `notifications`, `audit` y `health` (terminus) para extender negocio sin romper la API.
- **Validación DTO:** helper `validateDto` centraliza validaciones con `class-validator`/`class-transformer`, evitando dependencias del `ValidationPipe` global.
- **Pruebas E2E:** Jest + Supertest (`apps/api/test/app.e2e-spec.ts`) cubre login, onboarding de influencers, flujo VTEX completo y verificaciones del motor de comisiones.

## Integraciones VTEX (Fase 5)
- **Cliente compartido:** paquete `@marketing-afiliados/vtex-client` ahora incluye cliente HTTP con control de tiempo, reintentos, rotación de credenciales (`credentials` pool), validación de firmas HMAC y normalización de pedidos/reportes con soporte offline.
- **Configuración:** se amplían variables `VTEX_*` (`VTEX_TIMEOUT_MS`, `VTEX_MAX_RETRIES`, `VTEX_RETRY_DELAY_MS`, `VTEX_WEBHOOK_SECRET`, `VTEX_DEFAULT_CURRENCY`, `VTEX_INCLUDE_SHIPPING`, `VTEX_CREDENTIALS`) validadas vía Joi y documentadas en `.env.shared`.
- **Módulo Vtex:** `apps/api/src/modules/vtex` gestiona sincronización de cupones, webhooks con verificación de firma y conciliaciones; expone `/vtex/codes/:id/sync`, `/vtex/webhooks/orders`, `/vtex/reconciliations` y `/vtex/reconciliations/run`.
- **Sincronización de cupones:** al aprobar o suspender influencers, `VtexService` crea/actualiza cupones VTEX y activa/desactiva según estado de campaña e influencer, actualizando `vtexCouponId` y `status` locales.
- **Webhooks y comisiones:** carga útil se normaliza para mapear SKU/categorías y calcular montos elegibles por reglas de campaña; los eventos se firman, se registran intentos y alimentan órdenes/comisiones (`/commissions`, `/orders`).
- **Reconciliación diaria:** se habilita reconciliación automática con alertas por discrepancias, almacenamiento de logs y endpoint manual; los resultados están disponibles en `GET /commissions/reconciliations`.

## Motor de comisiones y saldos (Fase 6)
- **Motor de cálculo:** cada comisión persiste `commissionAmount`, `commissionRate`, `tierLevel` y `auditTrail`; el porcentaje aplicado corresponde al tier vigente cuando se recibe el evento VTEX.
- **Saldos por influencer:** `GET /api/v1/commissions/balances` expone montos estimados, confirmados, revertidos y saldo disponible (se admite saldo negativo tras devoluciones).
- **Evaluación de tiers:** `POST /api/v1/commissions/tiers/evaluate` utiliza una ventana base de 15 días (configurable por campaña) para recalcular porcentajes y registrar upgrades/downgrades en `listTierHistory`.
- **Corte quincenal manual:** `POST /api/v1/commissions/settlements/run` confirma comisiones estimadas cuando vence la ventana de devoluciones y revierte pedidos cancelados, actualizando balances y auditoría.
- **Auditoría centralizada:** `GET /api/v1/commissions/audit` y `GET /api/v1/audit/logs` consolidan transiciones automáticas/manuales con sello temporal y `triggeredBy`.
- **Pruebas E2E:** `apps/api/test/app.e2e-spec.ts` valida login, flujo VTEX, motor de comisiones, saldos, evaluación de tiers y settlement.

## Pagos y retiros (Fase 7)
- **Solicitudes de retiro:** `POST /api/v1/payments/withdrawals` exige `influencerId`, marca y monto; valida el mínimo configurable por marca (política inicial Cetaphil: COP 20.000) y reserva saldo (`pendingWithdrawalAmount`).
- **Workflow Finance:** `PATCH /api/v1/payments/withdrawals/:id/decision` y `POST /api/v1/payments/withdrawals/:id/pay` actualizan estados (`pending → approved → paid`), enlazan conciliaciones y ajustan balances (`withdrawnAmount`). Se permite autoaprobación previa al pago cuando la solicitud sigue pendiente.
- **Historial y soportes:** `GET /api/v1/payments` y `GET /api/v1/payments/withdrawals` filtran por influencer o estado; `POST /api/v1/payments/:id/documents` y `POST /api/v1/payments/withdrawals/:id/documents` conservan comprobantes/retenciones.
- **Notificaciones operativas:** el `NotificationsService` guarda eventos (`withdrawal.requested`, `withdrawal.approved`, `payment.recorded`) consultables en `GET /api/v1/notifications/pending`, habilitando trazabilidad para Finance/gestión.
- **Conciliaciones y ajustes:** los cierres (`POST /api/v1/vtex/reconciliations`) generan ajustes pendientes cuando una conciliación detecta cancelaciones o pedidos ausentes en VTEX. Los ajustes se consultan en `GET /api/v1/payments/adjustments` y pueden resolverse con `PATCH /api/v1/payments/adjustments/:id/resolve` (tipos `recovered` / `written_off`). Los saldos admiten valores negativos tras reversas, quedando el ajuste documentado hasta su recuperación o baja contable.
- **Pruebas E2E:** se amplió `apps/api/test/app.e2e-spec.ts` para cubrir solicitud → aprobación → pago, verificación de balances post-pago y registros en la cola de notificaciones (`pnpm --filter @marketing-afiliados/api test`).
- **Decisiones clave:** mínimos por marca configurados en memoria (20K COP), pagos requieren coincidencia exacta con el monto aprobado, los saldos permiten valores negativos tras devoluciones y los ajustes pendientes reducen la capacidad de retiro hasta ser resueltos; los endpoints siempre demandan `influencerId` explícito para limitar el alcance de los datos expuestos.

## Frontend React + Ant Design (Fase 8)
- **Nueva app Next.js 14 (`apps/web`)** con Ant Design 5, selector de idioma (ES/EN), tematización por marca y layout protegido por rol.
- **Proveedor de autenticación (`AuthProvider`)** con persistencia de tokens, refresco automático, `AuthGuard` en `AppLayout` y menú de usuario con cierre de sesión.
- **Landing + registro público**: formulario con validaciones, hash de consentimiento (`sha256`), adjuntos opcionales y consumo de `POST /api/v1/public/influencers`.
- **Dashboards por rol** (Influencer, Gestor/Admin Marca, Finance, Admin/Auditor) alimentados por los nuevos endpoints `/api/v1/dashboard/*`, con métricas, tablas de operaciones y notificaciones contextualizadas.
- **Endpoints sumados:** `/api/v1/dashboard/influencer`, `/gestor`, `/finance`, `/admin` y soporte para `influencerId` en `GET /api/v1/commissions/balances` para exponer únicamente el saldo propio del influencer autenticado.
- **Capas de datos** basadas en React Query y hooks (`useDashboardData`) reutilizados por los componentes y el header.
- **Seeds y usuarios demo** para cada rol con contraseña `changeit` (`admin@medipiel.co`, `gestor@medipiel.co`, `finance@medipiel.co`, `marca@medipiel.co`, `auditor@medipiel.co`, `influencer@medipiel.co`). En modo test los seeds visuales se omiten (`NODE_ENV=test`).

  | Rol | Usuario | Contraseña |
  | --- | --- | --- |
  | Admin Dentsu | `admin@medipiel.co` | `changeit` |
  | Gestor Afiliados | `gestor@medipiel.co` | `changeit` |
  | Finance | `finance@medipiel.co` | `changeit` |
  | Admin Marca | `marca@medipiel.co` | `changeit` |
  | Auditor | `auditor@medipiel.co` | `changeit` |
  | Influencer demo | `influencer@medipiel.co` | `changeit` |
- **Testing frontend**: Vitest ejecuta pruebas de utilidades (`hash`, `storage`, `routes`). El script global `pnpm test` ejecuta lint + Jest (API) + Vitest (web) + pruebas del worker, además de validar la documentación.
- **Ejecución local del frontend:** `pnpm --filter @marketing-afiliados/web dev` levanta el servidor Next.js con las vistas y servicios ya conectados al backend.

### Comandos útiles
- `pnpm install` – instala dependencias en el monorepo.
- `pnpm lint` – ejecuta ESLint sobre `apps/`, `packages/` y `scripts/`.
- `pnpm test` – corre lint y validaciones de documentación configuradas.
- `pnpm format` / `pnpm format:check` – aplican o validan formato con Prettier.
- `docker compose -f infrastructure/compose/docker-compose.yml up` – levanta el entorno local completo (requiere Docker y variables `.env`).
- `pnpm --filter @marketing-afiliados/api test` – ejecuta las pruebas del backend (Jest + Supertest).
- `pnpm seed:qa` – genera el dataset QA descrito en `prisma/seed-qa.ts` (requiere `DATABASE_URL`).
- `pnpm test:e2e` – ejecuta las suites Playwright (actualmente marcadas con `fixme` mientras se habilita la ejecución headless).

## Documentos clave
- `docs/plan_trabajo.md`: roadmap por fases y tareas.
- `docs/arquitectura.md`: arquitectura lógica, flujos VTEX, decisiones de componentes.
- `docs/modelo_datos.md`: entidades, relaciones y consideraciones de performance.
- `docs/politicas_legales.md`: gestión de consentimientos y versionado de políticas.
- `docs/operacion_conciliacion.md`: proceso diario/quincenal de conciliación y manejo de discrepancias.
- `docs/seguridad_cumplimiento.md`: controles de seguridad, observabilidad e incidentes.
- `docs/qa_plan.md`: estrategia de QA, pirámide de pruebas, suites automatizadas y mocks compartidos.
- `docs/qa_manual_checklist.md`: checklist de QA manual por roles y casos críticos previos al release.
- `docs/openapi.yaml` / `docs/openapi.json`: contrato OpenAPI 3.1 expuesto también en `/api/docs`.

## Próximos pasos
1. Rehabilitar los escenarios Playwright (`apps/e2e`) una vez que el flujo UI y seeds QA estén estabilizados para ejecución headless.
2. Automatizar la exportación del contrato OpenAPI y la orquestación de seeds QA en CI/CD.
3. Preparar la fase 11: estrategia de despliegue y runbooks operativos basados en los resultados de QA.
