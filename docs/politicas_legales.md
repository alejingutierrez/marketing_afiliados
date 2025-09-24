# Gestión de políticas legales y consentimientos

## Objetivo
Asegurar el cumplimiento de Habeas Data en Colombia y otros marcos aplicables, registrando la aceptación de términos y políticas con trazabilidad completa.

## Políticas cubiertas
1. **Términos y Condiciones del programa de afiliados.**
2. **Política de Tratamiento de Datos Personales (Habeas Data).**
3. **Política de Privacidad y Cookies (si aplica).**

Cada política tendrá versiones mayores con control de cambios, responsables y fecha de publicación.

## Proceso de versionado
1. Redacción/actualización legal (equipo Legal/Compliance).
2. Revisión por stakeholders (Admin Dentsu, Gestor Afiliados, Finance para implicaciones fiscales).
3. Aprobación formal y publicación del documento en repositorio interno (S3/Sharepoint) generando `checksum` y URL inmutable.
4. Registro en base de datos (**PolicyVersion**) con:
   - `policy_type`
   - `version` (semver: `MAJOR.MINOR`)
   - `published_at`
   - `document_url`
   - `checksum`
   - `is_active`
5. Notificación automática a usuarios relevantes cuando haya versión nueva (email + banner en plataforma).

## Captura de consentimientos
- Formulario público y paneles internos muestran siempre la versión vigente.
- Para influenciadores con sesión activa cuando se publica versión nueva, se solicita aceptación obligatoria antes de continuar operando.
- Campos almacenados en **LegalConsent**:
  - `influencer_id`
  - `policy_version_id`
  - `accepted_at`
  - `ip_address`
  - `user_agent`
  - `consent_hash` (SHA256 del documento + timestamp + usuario para integridad)
  - `accepted_by` (para consentimientos recabados manualmente)

## Evidencia y auditoría
- Generación de constancia PDF/HTML por aceptación, incluyendo metadatos y contenido de la política aceptada.
- Descarga disponible desde panel de Auditor y desde perfil del influencer.
- Exportaciones periódicas (mensuales) a almacenamiento seguro para respaldo.

## Revocatoria y derechos ARCO
- Canal dedicado (formulario/email) para que los influencers puedan revocar consentimiento o solicitar actualización de datos.
- Flujos internos para bloquear cuentas sobre las que se revocó consentimiento, mientras se procesa baja completa.
- Registro en **AuditLog** de cada solicitud ARCO y su resolución.

## Retención y eliminación
- Retener consentimientos al menos por el período legal requerido (mínimo 5 años en Colombia) y mientras existan obligaciones fiscales.
- Al eliminar definitivamente un influencer, se anonimizan datos personales pero se mantienen registros contables requeridos (enlace a `consent_hash`).

## Responsables
- **Owner legal:** Equipo Legal Dentsu/Medipiel.
- **Custodio técnico:** Equipo de plataforma (Admin Dentsu).
- **Auditoría:** Rol Auditor con acceso de solo lectura al módulo de consentimientos y descargas.

## Integraciones futuras
- Integración con firma electrónica avanzada para consentimientos reforzados.
- Sincronización con CRM legal para trazabilidad centralizada.
