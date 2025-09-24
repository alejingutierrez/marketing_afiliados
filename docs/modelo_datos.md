# Modelo de datos – Plataforma de marketing de afiliados

## Principios generales
- Base de datos relacional PostgreSQL administrada mediante Prisma Migrate.
- Todas las tablas incluyen columnas estándar: `id` (UUID), `created_at`, `updated_at`, `deleted_at` (soft delete cuando aplique) y `tenant_id` (soporte multimarcas dentro de Medipiel).
- Campos sensibles (datos bancarios, documentos adjuntos) se almacenan cifrados y, cuando sean archivos, se guardan en S3 con metadatos referenciados en la base.

## Entidades principales

### 1. **Influencer**
- Campos: `first_name`, `last_name`, `document_type`, `document_number`, `email`, `phone`, `address`, `city`, `country`, `social_links` (JSON), `bank_account` (JSON cifrado), `tax_profile`, `status` (`pending`, `approved`, `rejected`, `suspended`), `rejection_reason`.
- Relaciones:
  - `consents` (1:N) con **LegalConsent**.
  - `applications` (1:N) con **CampaignInfluencer**.
  - `codes` (1:N) con **DiscountCode**.
  - `balances` (1:1) con **InfluencerBalance**.
  - `withdraw_requests` (1:N) con **WithdrawalRequest**.

### 2. **LegalConsent**
- Registra aceptación de políticas y términos con versionado.
- Campos: `influencer_id`, `policy_version_id`, `accepted_at`, `ip_address`, `user_agent`, `consent_hash`.
- Relación: N:1 con **PolicyVersion**.

### 3. **PolicyVersion**
- Control de versiones de Términos y Habeas Data.
- Campos: `policy_type` (`terms`, `privacy`, `habeas_data`), `version`, `published_at`, `document_url`, `checksum`.
- Relación: 1:N con **LegalConsent**.

### 4. **Brand**
- Representa sub-marcas (p. ej., Cetaphil).
- Campos: `name`, `slug`, `description`, `status`, `owner_user_id` (Admin Marca), `logo_url`.
- Relación: 1:N con **Campaign**.

### 5. **Campaign**
- Configuración de campañas por marca.
- Campos: `brand_id`, `name`, `slug`, `description`, `start_date`, `end_date`, `status` (`draft`, `active`, `paused`, `ended`), `commission_base` (porcentaje base), `commission_basis` (`pre_tax`, `post_tax`), `max_discount_percent`, `max_usage`, `min_order_value`, `confirmation_window_days`, `stacking_rules` (JSON), `eligible_scope_type` (`sku`, `category`), `eligible_scope_values` (JSON).
- Relaciones:
  - 1:N con **CampaignTier**.
  - 1:N con **CampaignInfluencer**.
  - 1:N con **DiscountCode**.
  - 1:N con **OrderAttribution** (pedidos atribuidos).

### 6. **CampaignTier**
- Define niveles Base/Avanzado/Elite u otros.
- Campos: `campaign_id`, `name`, `level`, `threshold_confirmed_sales`, `commission_percent`, `evaluation_period_days`, `is_default`.

### 7. **CampaignInfluencer**
- Unión entre Influencers y Campañas.
- Campos: `campaign_id`, `influencer_id`, `assigned_at`, `assigned_by`, `status` (`active`, `inactive`), `notes`.
- Sirve para gestionar aprobación por marca.

### 8. **DiscountCode**
- Código por influencer por campaña/marca.
- Campos: `campaign_id`, `influencer_id`, `code`, `prefix`, `suffix`, `status`, `discount_percent`, `start_date`, `end_date`, `max_usage`, `usage_count`, `conditions` (JSON), `vtex_coupon_id`.
- Relaciones: N:1 con **Campaign** y **Influencer**; 1:N con **OrderAttribution**.

### 9. **Order**
- Pedido recibido de VTEX.
- Campos: `order_id` (VTEX), `status` (`created`, `paid`, `invoiced`, `shipped`, `canceled`, `returned`), `placed_at`, `paid_at`, `currency`, `total_amount`, `customer_email`, `raw_payload` (JSONB), `origin_channel`.
- Relaciones:
  - 1:N con **OrderLine**.
  - 1:1 con **OrderAttribution** (si hay código) y **CommissionTransaction** (por estado).

### 10. **OrderLine**
- Detalle por SKU.
- Campos: `order_id`, `sku_id`, `sku_ref`, `title`, `quantity`, `unit_price`, `total_price`, `tax_amount`, `category`, `eligible_for_commission` (bool).

### 11. **OrderAttribution**
- Registro de que un pedido fue atribuido a un influencer/código.
- Campos: `order_id`, `discount_code_id`, `influencer_id`, `campaign_id`, `attributed_amount`, `eligible_amount`, `stacking_details` (JSON).
- Relación: 1:N con **CommissionTransaction**.

### 12. **CommissionTransaction**
- Movimiento de comisión derivado de un pedido.
- Campos: `order_id`, `order_attribution_id`, `influencer_id`, `campaign_id`, `tier_level`, `state` (`estimated`, `confirmed`, `reverted`), `gross_amount`, `net_amount`, `calculated_at`, `confirmed_at`, `reverted_at`, `reason`, `metadata`.
- Relación: N:1 con **Influencer**, **Campaign**, y **InfluencerBalance** (actualiza saldo).

### 13. **InfluencerBalance**
- Saldo acumulado por influencer.
- Campos: `influencer_id`, `estimated_amount`, `confirmed_amount`, `reverted_amount`, `available_for_withdrawal`, `last_calculated_at`.

### 14. **WithdrawalRequest**
- Solicitudes de retiro.
- Campos: `influencer_id`, `requested_amount`, `status` (`pending`, `approved`, `rejected`, `paid`), `requested_at`, `processed_at`, `processed_by`, `payment_reference`, `attachments` (JSON), `notes`.
- Relación: N:1 con **Payment** (cuando se materializa).

### 15. **Payment**
- Registro de pagos efectuados.
- Campos: `withdrawal_request_id`, `influencer_id`, `amount`, `payment_date`, `method`, `reference`, `voucher_url`, `tax_withheld`, `processed_by`.

### 16. **ReconciliationLog**
- Resultados de procesos de reconciliación (diaria/quincenal).
- Campos: `run_date`, `type` (`daily`, `fortnightly`), `status`, `discrepancies_found`, `report_url`, `summary` (JSON), `triggered_by`.

### 17. **AuditLog**
- Registro de eventos administrativos.
- Campos: `entity`, `entity_id`, `action`, `performed_by`, `role`, `payload_before`, `payload_after`, `ip_address`, `performed_at`.

### 18. **NotificationQueue**
- Estado de notificaciones enviadas.
- Campos: `type`, `recipient`, `template`, `payload`, `status`, `attempts`, `last_attempt_at`, `error_message`.

## Relaciones clave (resumen)
- `Influencer` 1—N `CampaignInfluencer` N—1 `Campaign`.
- `Influencer` 1—N `DiscountCode` N—1 `Campaign`.
- `DiscountCode` 1—N `OrderAttribution` 1—1 `Order`.
- `OrderAttribution` 1—N `CommissionTransaction` → actualiza `InfluencerBalance`.
- `CommissionTransaction` 1—N `WithdrawalRequest` (por saldo disponible) → 1—1 `Payment`.

## Tablas de soporte
- `Role` y `UserRole` para administración de permisos (Admin Dentsu, Admin Marca, Gestor, Finance, Auditor, Influencer).
- `WebhookDeliveryLog` para seguimiento de callbacks VTEX (estado, payload, reintentos).
- `ScheduledJob` para cron jobs (estado, última ejecución, duración, errores).

## Consideraciones de performance
- Índices compuestos en `order_id`, `campaign_id`, `influencer_id` para consultas de dashboards.
- Particionamiento temporal de tablas de auditoría y webhooks.
- Uso de vistas materializadas para métricas agregadas (ventas por campaña, ranking influencers) actualizadas por worker.

## Próximos pasos
- Crear diagramas ERD visuales a partir de este documento.
- Validar campo a campo con equipos financiaros y legales (especial atención a formatos de identificación y retenciones).

## Implementación técnica (Fase 2)
- El modelo está materializado en `prisma/schema.prisma`, empleando PostgreSQL como datasource y Prisma Client.
- Los tipos monetarios se gestionan con `Decimal` y precisión definida (`@db.Decimal`) para prevenir pérdidas.
- Las relaciones clave (influencers ↔ campañas, pedidos ↔ comisiones, consentimientos) cuentan con índices y restricciones únicas alineadas al diseño.
- La migración inicial (`prisma/migrations/000_init/migration.sql`) crea tablas, enums y roles base con `pgcrypto` habilitado para UUIDs.
