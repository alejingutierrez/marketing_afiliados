# Plan de QA y pruebas automatizadas

## Objetivo
Establecer la estrategia integral de aseguramiento de calidad para la plataforma de marketing de afiliados. El plan cubre la pirámide de pruebas (unitarias, integración y end-to-end), los mocks necesarios para desacoplar dependencias externas, los datasets de referencia para QA/staging y una guía de verificación manual por roles.

## Pirámide de pruebas
- **Nivel 1 – Pruebas unitarias:** validan reglas de negocio y utilidades puras. Se ejecutan con Jest (API), Vitest (web) y Node Test Runner (worker). Cobertura obligatoria:
  - Motor de comisiones: evaluación de tiers, cálculo neto/confirmado, ajustes por reversas.
  - Validaciones de políticas y consentimientos (DTOs, hashing, expiración de versiones).
  - Utilidades frontend: hooks de políticas, almacenamiento seguro, hashing.
  - Worker: generación de respaldos y métricas (sin tocar filesystem real fuera de `/tmp`).
- **Nivel 2 – Pruebas de integración:** ejercen módulos NestJS con `InMemoryDatabaseService` y stubs VTEX/email. Validan la interacción API + base + colas sin depender de servicios remotos.
  - Flujo completo `order.created` → comisión estimada → saldo disponible.
  - Flujo quincenal `runSettlement` aplicando ventana de espera.
  - Aprobación/rechazo de retiros y generación de notificaciones.
- **Nivel 3 – Pruebas end-to-end:** simulan flujos críticos de usuario sobre la UI y la API.
  - Registro público de influencer aceptando políticas vigentes.
  - Login administrativo con 2FA y aprobación de influencer.
  - Solicitud de retiro desde panel influencer y aprobación Finance.
  - Consulta de dashboards por rol y lectura de alertas de conciliación.
  - Se automatizan con Playwright (`apps/e2e`), reutilizando seeds QA y sirviendo API/Next en memoria de prueba.

## Suites automatizadas
| Suite | Herramienta | Alcance | Comentarios |
| --- | --- | --- | --- |
| `apps/api` unit | Jest | Servicios in-memory, utilidades de seguridad | Nueva cobertura sobre `InMemoryDatabaseService`, hashing y configuración.
| `apps/api` integración | Jest + Nest Testing Module | Flujos órdenes→comisiones, retiros y reconciliación | Usa mocks VTEX/email + seeds in-memory.
| `apps/api` e2e | Jest + Supertest | Flujos API REST desde el AppModule | Ya existente; se refactoriza para usar factories compartidas.
| `apps/web` unit | Vitest + Testing Library | Hooks, helpers y componentes aislados | Suite existente, se amplía cobertura.
| `apps/e2e` (frontend) | Playwright | Flujos registro/login/dashboard | Nueva suite controlada por `pnpm test:e2e` y orquestada en `pnpm test`.
| `apps/worker` unit | Node Test Runner | Backups, métricas, manejo de señales | Suite actual, se agregan casos para cron y telemetría. |
| `apps/e2e` (frontend) | Playwright | Flujos registro/login/dashboard | Suite inicial creada; temporalmente marcada con `test.describe.fixme` mientras se estabiliza el flujo headless con componentes Ant Design. |

## Mocks y stubs compartidos
- **VTEX:** implementación `MockVtexClient` que simula gestión de cupones, órdenes y reportes. Expuesto desde `apps/api/test/mocks/vtex-client.mock.ts` y utilizable en pruebas de integración/e2e.
- **EmailService:** stub configurable que captura alertas en memoria y permite aserciones sin SMTP real.
- **Servicios externos frontend:** interceptores Playwright para responder APIs (`/api/v1/*`) con fixtures cuando la API real no esté corriendo.
- **Dataset QA:** script `pnpm seed:qa` basado en Prisma (archivo `prisma/seed-qa.ts`) que inserta tenants, usuarios demo por rol, campañas, códigos, pedidos y saldos consistentes con los escenarios de pruebas.

## QA manual por rol
- **Influencer**
  - Registro público con documentos adjuntos y verificación de confirmación por correo.
  - Acceso al panel, revisión de dashboard, historial de pedidos y solicitud de retiro.
  - Verificación de notificaciones ante reversas y alertas de conciliación.
- **Gestor de Afiliados**
  - Aprobación/rechazo de influencers con notas.
  - Asignación de campañas y códigos personalizados.
  - Monitoreo de discrepancias de conciliación y reprocesamiento de pedidos.
- **Finance**
  - Revisión de cola de retiros, aprobación y registro de comprobantes.
  - Descarga de reportes quincenales y validación de ajustes negativos.
  - Confirmación de exportes fiscales y almacenamiento seguro.
- **Admin Marca**
  - Consulta de campañas activas, actualización de reglas y vigencias.
  - Validación de dashboards por marca y alertas específicas.
- **Auditor**
  - Descarga de constancias de consentimiento, revisión de `audit_log`.
  - Verificación de integridad de backups y métricas de reconciliación.
- **Soporte/Operaciones**
  - Ejecución manual de jobs de conciliación y settlement bajo demanda.
  - Revisión de alertas críticas en Grafana y canal de correo.

Cada ciclo de QA manual debe registrarse en un checklist (plantilla `docs/qa_manual_checklist.md`) con resultado por caso y evidencia adjunta cuando aplique.

## Criterios de aceptación de la fase 10
1. Todas las suites automatizadas descritas se ejecutan en `pnpm test` y pasan en local y CI.
2. El portal de documentación API (Swagger/Redoc) expone endpoints `v1` y se versiona junto al repositorio (`docs/openapi.json`).
3. `pnpm seed:qa` prepara un entorno funcional en Postgres local y se documenta en README.
4. Existen checklists y datasets que permiten reproducir incidentes y validar regresiones antes del release.
