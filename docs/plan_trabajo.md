# Plan de trabajo integral – Plataforma de marketing de afiliados

El plan se organiza en fases secuenciales; cada fase define objetivos, entregables y tareas que cubren los requerimientos del MVP descritos. El repositorio se mantendrá dockerizado, full JavaScript/TypeScript (Node.js + React/Ant Design) y alineado con buenas prácticas de seguridad, cumplimiento y observabilidad.

## Fase 0 – Alineación estratégica y discovery
**Objetivo:** Aterrizar alcance, prioridades y restricciones operativas.
1. Taller de kickoff con stakeholders (Admin Dentsu, Admin Marca, Gestor Afiliados, Finance, Auditor, Influencers piloto) para validar alcance MVP, KPIs, criterios de éxito y roadmap post-MVP.
2. Recopilar políticas legales (Términos, Habeas Data Colombia), versionarlas y definir responsables de actualización y proceso de evidencia de consentimiento.
3. Documentar SLA internos (webhooks VTEX, procesamiento conciliaciones, notificaciones email) y expectativas de latencia/uptime.
4. Definir lineamientos de cumplimiento (manejo de datos personales, resguardo de datos bancarios, políticas de retención fiscal) y responsables de auditoría.

## Fase 1 – Arquitectura técnica y diseño del repositorio
**Objetivo:** Establecer estructura técnica base y principios de diseño.
1. Seleccionar frameworks: Backend con NestJS (o Express modular) en TypeScript; Frontend con React + Ant Design (Next.js o Vite). Documentar elección.
2. Diseñar monorepo con `apps/` (frontend, backend, workers), `packages/` (UI compartida, SDK VTEX, librería dominios) y `infrastructure/` (docker, compose, scripts).
3. Definir versiones de Node.js, gestor de paquetes (pnpm recomendado), herramientas de linting (ESLint, Prettier), testing (Jest/Vitest, Playwright/Cypress) y estándares de commit (Conventional Commits).
4. Elaborar diagramas de arquitectura lógica: módulos de influencers, campañas/códigos, tracking VTEX, motor de comisiones, pagos, reporting, notificaciones, seguridad/observabilidad.
5. Determinar estrategia de configuración: árbol de `.env`, jerarquía de configuraciones por entorno, manejo de secretos y política de rotación.

## Fase 2 – Gobernanza de datos y modelado de dominio
**Objetivo:** Crear modelo de datos robusto y flujos de migración.
1. Seleccionar PostgreSQL como base principal; definir uso de Redis para colas/notificaciones y almacenamiento de archivos (S3 compatible) para documentos.
2. Diseñar modelo entidad-relación cubriendo: influencers, documentos legales con versionado y timestamp, marcas, campañas, tiers, SKUs elegibles, códigos por influencer/campaña, pedidos VTEX, líneas de pedido, transacciones de comisión, solicitudes de retiro, pagos, reversas, audit log.
3. Definir ORM/migrador (Prisma recomendado) y crear migración inicial con seeds mínimos (roles, estados base).
4. Documentar contratos de datos (DTOs) y reglas de validación (formato cédula/NIT, IBAN/ACH local si aplica, emails, teléfonos).
5. Establecer políticas de almacenamiento seguro de datos bancarios (encriptación en reposo, acceso restringido).

## Fase 3 – Cimientos del repositorio y tooling
**Objetivo:** Inicializar monorepo con herramientas de productividad.
1. Inicializar repositorio Git con estructura definida; configurar pnpm workspaces.
2. Añadir configuración base: TypeScript, ESLint, Prettier, Husky/lint-staged, editorconfig, commitlint.
3. Crear Dockerfiles para backend, frontend y worker; preparar `docker-compose.yml` con servicios (api, web, postgres, redis, mailhog, grafana/prometheus opcional).
4. Configurar scripts de desarrollo (`pnpm dev`, `pnpm lint`, `pnpm test`), y plantillas de GitHub (`.github/ISSUE_TEMPLATE`, `PULL_REQUEST_TEMPLATE`, workflows CI: lint + test + build).
5. Documentar en `docs/` guías de instalación local, estructura del repo, flujos de trabajo y gestión de secretos.

## Fase 4 – Backend: foundation y módulos core
**Objetivo:** Levantar API base y módulos esenciales.
1. Generar proyecto backend (NestJS) con estructura modular (`modules/influencers`, `modules/campaigns`, `modules/codes`, `modules/orders`, `modules/commissions`, `modules/payments`, `modules/notifications`, `modules/audit`, `modules/auth`).
2. Configurar servidor HTTP (`/api/v1`), middlewares (CORS, helmet, rate limiting, logging Pino), manejo de errores y DTO validation (class-validator).
3. Autenticación/ autorización: JWT + refresh tokens, roles (Admin Dentsu, Admin Marca, Gestor Afiliados, Finance, Auditor, Influencer), RBAC por rutas.
4. Módulo Influencers:
   - Endpoint de auto-registro público con validación KYC básica, aceptación de políticas con versión y sello de tiempo, carga de datos bancarios (solo captura).
   - Gestión interna: listar, filtrar, aprobar/rechazar, actualizar perfil, asignar códigos/campañas.
   - Registro de historial de estados y observaciones.
5. Módulo Marcas/Campañas:
   - CRUD de marcas, definiciones de campañas (vigencia, SKUs/categorías elegibles, reglas de comisión base, ventanas de confirmación).
   - Configuración de tiers (Base/Avanzado/Elite) con thresholds y % variable.
   - Asignación de influencers a campañas/marcas, soporte multi-campaña por influencer.
6. Módulo Códigos de descuento:
   - Generación automática siguiendo formato configurable (prefijo marca + identificador) y validación de unicidad.
   - Gestión de condiciones (descuento %, expiración, usos máximos, exclusiones SKU/categoría).
   - Estado del código ligado a estado influencer/campaña.
7. Módulo Notificaciones: integración con proveedor SMTP (Mailhog dev, SendGrid/SES prod), cola asíncrona (BullMQ) y plantillas de email (bienvenida, aprobación/rechazo, activación, corte quincenal, solicitud pago, alertas reversas).
8. Módulo Auditoría: definir eventos a capturar (altas/bajas, cambios comisiones, pagos, configuraciones), persistir con usuario, timestamp, payload, y exponer consultas paginadas para rol Auditor.

## Fase 5 – Integración VTEX y sincronización de códigos
**Objetivo:** Conectar con APIs VTEX y mantener códigos sincronizados.
1. Crear SDK interno `packages/vtex-client` con autenticación, rotación de tokens y funciones para cupones, pedidos, reconciliación.
2. Al aprobar influencer: crear/actualizar cupón en VTEX, activarlo según estado campaña; manejar desactivación al deshabilitar influencer/campaña.
3. Configurar webhooks VTEX (pedidos creados, pagados/confirmados, devueltos/cancelados); implementar verificación de firma, reintentos, logging y alarmas.
4. Normalizar payloads: mapear SKUs/ítems a campañas, calcular total elegible según reglas de campaña (incluir/excluir impuestos y envío configurable).
5. Reconciliación diaria automática: consumir reportes VTEX, comparar con base interna, generar alertas de discrepancia y fallback manual.
6. Documentar flujos de error/contingencia (p. ej., webhook caído, cupón duplicado) y definir procedimientos operativos.

## Fase 6 – Motor de comisiones y saldos
**Objetivo:** Implementar lógica de negocio para comisiones y tiers.
1. Diseñar motor de cálculo basado en eventos VTEX: generar transacciones de comisión en estados (estimada, confirmada, revertida) según reglas de campaña.
2. Implementar evaluación de tiers por período definido (quincenal/mensual): recalcular % según ventas confirmadas, almacenar historial de upgrades/downgrades.
3. Gestionar saldos de influencer: totales estimados, confirmados, reversos; permitir que saldo quede negativo si hay devoluciones.
4. Construir procesos programados (cron/worker) para corte quincenal, ventanas de espera de devoluciones, ajustes por conciliación.
5. Registrar auditoría de cambios automáticos y manuales sobre comisiones y tiers.

## Fase 7 – Pagos, retiros y soporte fiscal
**Objetivo:** Habilitar flujo completo de pagos y soporte contable.
1. Permitir solicitud de retiro desde panel influencer cuando saldo confirmados supera mínimo configurable por marca.
2. Workflow Finance: revisar solicitudes, aprobar/rechazar, registrar datos de transferencia (referencia, fecha, soporte). Enviar notificaciones correspondientes.
3. Registrar documentos fiscales (retenciones, comprobantes) según perfil; permitir carga/descarga segura.
4. Exponer histórico de pagos y solicitudes en panel influencer y Finance.
5. Integrar con módulo de conciliación para reflejar reversas y ajustes posteriores al pago.

## Fase 8 – Frontend React + Ant Design
**Objetivo:** Construir UI para cada rol con experiencia consistente.
1. Inicializar app (Next.js recomendado) con Ant Design, configuración de tema (variables por marca), internacionalización (es/en) y routing protegido.
2. Crear layout base: navegación lateral adaptable por rol, header con notificaciones, breadcrumb y control de sesión.
3. **Flujo público:** landing + formulario de registro de influencers (con KYC, upload de documentos si aplica, aceptación de políticas guardando hash y timestamp).
4. **Panel Influencer:** dashboard de métricas (ventas por campaña, comisiones estimadas/confirmadas, progreso a siguiente tier), historial de pedidos, saldos y solicitudes de pago, alertas de reversas.
5. **Panel Gestor/Admin Marca:** tabla de influencers (estados, filtros por campaña/marca), detalle de perfil, acciones de aprobación/rechazo, asignación de códigos/campañas, vista de campañas y reglas.
6. **Panel Finance:** resumen de saldos confirmados, cola de solicitudes de pago, detalle de pagos, registro de retenciones.
7. **Panel Admin Dentsu/Auditor:** visión consolidada de marcas, ranking de influencers, alertas de conciliación, historial audit log con filtros.
8. Integración API: crear capa de servicios (RTK Query / React Query) con manejo de autenticación JWT, refresco de tokens, estados de carga/errores y control de permisos en UI.
9. Accesibilidad y responsividad: validar contrastes, uso de componentes Ant adecuados, manejo móvil/tablet básico.

## Fase 9 – Observabilidad, seguridad y cumplimiento
**Objetivo:** Garantizar monitoreo, seguridad y auditoría.
1. Implementar logging estructurado (Pino + OpenTelemetry), trazas distribuidas y métricas (Prometheus) para backend y workers.
2. Configurar dashboards (Grafana) para webhooks, colas pendientes, tiempos de respuesta API, reconciliaciones diarias.
3. Añadir alertas básicas (email) para fallas de webhook, discrepancias de conciliación, jobs atrasados.
4. Endurecer seguridad: headers HTTP, rate limiting por endpoint sensible, política de contraseñas, 2FA opcional para roles administrativos.
5. Documentar y auditar consentimiento de políticas: endpoint para generar constancias, descarga de histórico, triggers de notificación ante nuevos términos.
6. Revisar encriptación en reposo para datos sensibles (bancarios, documentos), segregación de accesos y backup automatizado.

## Fase 10 – QA, pruebas automatizadas y documentación
**Objetivo:** Asegurar calidad y conocimiento compartido.
1. Definir pirámide de pruebas: unitarias (motor comisiones, validaciones), integración (API + DB + VTEX mock), e2e (Playwright/Cypress) para flujos críticos (registro, aprobación, cupón VTEX, cálculo comisión, solicitud pago).
2. Crear mocks/stubs para VTEX y proveedores de email en entornos de prueba.
3. Documentar API con OpenAPI/Swagger y publicar portal interno para consumo.
4. Elaborar manuales por rol, guías de operación (conciliación diaria, manejo de reversas), política de manejo de incidentes.
5. Generar datasets de prueba y scripts de seed para QA/staging.
6. Ejecutar sesiones de QA manual con checklist funcional y de seguridad.

## Fase 11 – Despliegue, operaciones y soporte continuo
**Objetivo:** Preparar release y operación post-lanzamiento.
1. Definir entornos (dev, staging, prod), naming, ramas Git y proceso de release (CI/CD con imágenes Docker en registry).
2. Configurar infraestructura de despliegue (Docker Compose administrado, Kubernetes, ECS) con monitoreo, backups y rotación de secretos.
3. Ejecutar smoke tests post-deploy, checklist de go-live (webhooks registrados, campañas cargadas, notificaciones funcionando).
4. Establecer runbooks de soporte (incidentes VTEX, reversas manuales, caídas de email) y SLAs de respuesta.
5. Planificar retroalimentación post-MVP: encuestas a usuarios clave, priorización de backlog (automatización fiscal, dashboards avanzados, notificaciones push, integraciones adicionales).
6. Formalizar proceso de mejora continua y gobernanza de releases.

---
**Documentos complementarios sugeridos:**
- `docs/arquitectura.md`: diagramas y decisiones técnicas.
- `docs/modelo_datos.md`: ERD y definiciones de campos.
- `docs/politicas_legales.md`: control de versiones de términos y consentimientos.
- `docs/operacion_conciliacion.md`: procedimientos diarios/quincenales.
- `docs/seguridad_cumplimiento.md`: controles de seguridad y auditoría.
