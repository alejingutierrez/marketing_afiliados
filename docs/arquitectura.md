# Arquitectura de la plataforma de marketing de afiliados

## Visión general
La plataforma se implementará como un monorepo TypeScript/JavaScript con múltiples aplicaciones y paquetes compartidos. El objetivo es habilitar un ecosistema modular, escalable y dockerizado que soporte la gestión de influencers, campañas, códigos de descuento, tracking VTEX, cálculo de comisiones y pagos.

```
marketing_afiliados/
├─ apps/
│  ├─ web/                # Frontend React + Ant Design (Next.js)
│  ├─ api/                # Backend NestJS (REST API / Webhooks)
│  └─ worker/             # Procesos asíncronos (BullMQ)
├─ packages/
│  ├─ ui/                 # Componentes UI compartidos Ant Design
│  ├─ vtex-client/        # SDK de integración VTEX
│  └─ domain/             # Lógica de dominio compartida (cálculos, validaciones)
├─ infrastructure/
│  ├─ docker/             # Dockerfiles, scripts de build
│  ├─ compose/            # docker-compose.yml y overrides por entorno
│  └─ terraform/helm/     # Manifests (opcional, para entornos administrados)
└─ docs/                  # Documentación funcional y técnica
```

## Componentes principales
- **Frontend web (`apps/web`)**: Next.js con Ant Design, React Query/RTK Query para consumo de API, internacionalización (ES/EN), theming por marca y routing protegido por rol.
- **Backend API (`apps/api`)**: NestJS siguiendo arquitectura modular, expone endpoints REST `/api/v1`, webhooks VTEX, autenticación JWT/refresh y colabora con worker para tareas asíncronas.
- **Worker (`apps/worker`)**: Servicio Node.js que procesa colas BullMQ (envío de emails, sincronización VTEX, cálculos de comisiones, cortes quincenales).
- **Base de datos**: PostgreSQL como base transaccional principal con Prisma ORM. Redis para colas y caching ligero. Almacenamiento S3-compatible para documentos legales o soportes de pago.
- **Observabilidad**: Stack Prometheus + Grafana para métricas, Loki/Elastic para logs, OpenTelemetry para trazas. Mailhog en local para pruebas de email.

## Módulos backend (NestJS)
- `AuthModule`: autenticación JWT/refresh, roles y permisos RBAC, reset de contraseña, 2FA opcional.
- `InfluencersModule`: registro público (KYC), gestión interna, estados, asignación de campañas y códigos.
- `BrandsModule` y `CampaignsModule`: CRUD de marcas/campañas, vigencias, SKUs elegibles, tiers y reglas de comisión.
- `CodesModule`: generación y sincronización de códigos de descuento, reglas de uso, estado acorde a campaña/influencer.
- `OrdersModule`: recepción de eventos VTEX (creado/pagado/devuelto), consolidación de pedidos y líneas elegibles.
- `CommissionsModule`: motor de cálculo de comisiones, estados (estimada/confirmada/revertida), evaluación de tiers.
- `PaymentsModule`: saldos, solicitudes de retiro, aprobaciones Finance, registro de transferencias y retenciones.
- `NotificationsModule`: manejo de plantillas, colas de emails, alertas operativas.
- `AuditModule`: registro y consulta de auditoría de acciones administrativas.
- `IntegrationsModule`: clientes externos (VTEX, SMTP, almacenamiento, futuros ERPs/bancos).

## Flujos clave
1. **Registro influencer**: Frontend público → API (`POST /api/v1/influencers/register`) → validación → persistencia → notificación al Gestor.
2. **Aprobación influencer**: Gestor en panel → API → cambio de estado → creación/actualización de código → sincronización VTEX vía worker → email de aprobación.
3. **Pedido VTEX**: Webhook VTEX → API → validación firma → persistencia pedido + líneas → cálculo comisión estimada → actualización saldos y dashboards.
4. **Confirmación/reversa**: Evento VTEX (pagado/cancelado) → actualización de estado comisión → ajustes de saldo → notificaciones.
5. **Solicitud pago**: Influencer solicita → API valida saldo mínimo → crea ticket → cola para Finance → Finance aprueba → registro de pago → email.
6. **Reconciliación diaria**: Job programado worker → consumo reporte VTEX → comparación vs base interna → generación de alertas y reportes.

## Integraciones externas
- **VTEX**: APIs de cupones, pedidos y webhooks. Se maneja en `packages/vtex-client` con políticas de reintento, rate limiting y registro de fallas.
- **Proveedor de email**: SMTP (Mailhog local) y SendGrid/SES en cloud; integración centralizada en NotificationsModule.
- **Sistemas financieros**: Inicialmente manual; se prevén hooks para integraciones futuras (p. ej., archivos CSV o API bancarias).

## Infraestructura y despliegue
- **Local**: Docker Compose con servicios `web`, `api`, `worker`, `postgres`, `redis`, `mailhog`, `prometheus`, `grafana`.
- **CI/CD**: Github Actions ejecuta lint/test/build, genera imágenes Docker y las publica en registry. Despliegues automatizados a dev/staging/prod.
- **Producción**: Kubernetes/ECS o servidor Docker administrado. Se definen configuraciones por entorno, secretos en gestor dedicado (AWS SSM, Vault), certificados TLS gestionados.

## Seguridad y cumplimiento
- Tokenización y encriptación de datos sensibles (bancarios) con KMS.
- Versionado de políticas y almacenamiento de consentimientos con sello temporal.
- Audit log inmutable (tabla + exportación periódica).
- Monitoreo de webhooks (métricas y alertas) para detectar caídas y discrepancias.

## Consideraciones de escalabilidad
- División en microservicios futura habilitada: componentes desacoplados (API, worker, dashboards) ya aislados.
- Uso de colas para desacoplar integraciones y tareas intensivas.
- Sharding horizontal de base de datos considerado para etapas posteriores.
- Caching selectivo (Redis) para dashboards y métricas pesadas.

## Referencias adicionales
- `docs/modelo_datos.md` para detalle de entidades y relaciones.
- `docs/seguridad_cumplimiento.md` para controles de seguridad y auditoría.
- `docs/operacion_conciliacion.md` para procedimientos operativos.
