# Seguridad, cumplimiento y observabilidad

## Principios
- Cumplir con normas de protección de datos (Habeas Data Colombia) y mejores prácticas OWASP.
- Seguridad por capas: aplicación, infraestructura, datos y personas.
- Observabilidad integrada para detectar incidentes tempranamente.

## Gestión de identidades y accesos
- Autenticación JWT con refresh tokens; expiración corta y rotación automática.
- Roles y permisos granular (RBAC): Admin Dentsu, Admin Marca, Gestor, Finance, Auditor, Influencer.
- Posibilidad de habilitar 2FA para usuarios administrativos.
- Registro de actividades en `audit_log` incluyendo IP y user agent.
- Revisión trimestral de accesos y permisos.

## Protección de datos sensibles
- Cifrado en tránsito (HTTPS obligatorio, TLS 1.2+). Certificados gestionados por proveedor cloud.
- Cifrado en reposo:
  - Datos bancarios y documentos personales cifrados con AES-256 y claves gestionadas por KMS.
  - Column-level encryption para campos específicos (`bank_account`).
- Separación de secretos en gestor dedicado (Vault/Parameter Store) con rotación trimestral.
- Backups automáticos cifrados de PostgreSQL y S3 (retención 30/90/365 días según ambiente).

## Seguridad de aplicaciones
- Linter y análisis estático (ESLint, TypeScript) + SAST (GitHub Advanced Security, opcional).
- Dependabot o Renovate para actualización de dependencias críticas.
- Validaciones server-side exhaustivas (class-validator) y sanitización de entradas.
- Cabeceras de seguridad mediante Helmet (HSTS, XSS Protection, Content Security Policy base).
- Rate limiting por IP para rutas sensibles (login, registro, webhooks).
- Prevención CSRF en panel web (tokens y SameSite cookies cuando aplique).

## Seguridad de infraestructura
- Redes segmentadas: API/worker en subred privada, frontend detrás de CDN/WAF.
- Security groups / firewalls limitando puertos expuestos.
- Logs de acceso y sistema (`cloudtrail`/`auditd`) centralizados.
- Baseline de hardening en imágenes Docker (slim, usuarios non-root, escaneo de vulnerabilidades con Trivy).

## Observabilidad y monitoreo
- **Logging estructurado:** Pino + formato JSON, enviado a Loki/ELK.
- **Métricas:** Prometheus (latencia API, tasa de errores, jobs pendientes, webhooks procesados, colas BullMQ).
- **Trazas:** OpenTelemetry exportado a Jaeger/Tempo para seguir flujos complejos (VTEX → API → worker → DB).
- **Alertas:** configuradas en Grafana/Alertmanager para:
  - Falla de webhooks (>5% errores en 10 min).
  - Colas con >100 trabajos pendientes o jobs fallidas consecutivas.
  - Spike en errores 5xx API.
  - Fallo en jobs de conciliación/corte quincenal.
  - Envío inmediato de resúmenes por email vía `EmailService` (Mailhog en dev, SMTP corporativo en prod) con outbox auditable para cumplimiento.
- **SLA internos:**
  - Webhooks procesados < 2 min.
  - Conciliación diaria finalizada < 6 h posteriores al cierre del día.
  - Emails críticos enviados < 5 min.

## Cumplimiento y auditoría
- Tabla **audit_log** inmutable (solo append) con exportaciones mensuales a almacenamiento seguro.
- Controles de segregación de funciones: Finance no puede aprobar influencers; Gestor no puede aprobar pagos.
- Bitácora de consentimientos y revocatorias disponible para auditoría (ver `docs/politicas_legales.md`).
- Política de retención de datos definida por tipo (influencers activos vs inactivos).

## Gestión de incidentes
- Runbook documentado para incidentes (webhook caído, fuga de datos, fraude).
- Equipo de respuesta (Admin Dentsu + Legal + IT) con canales de comunicación definidos.
- Registro de incidentes y postmortems obligatorios.

## Pruebas y revisión
- PenTest anual externo enfocado en flujos críticos (registro, sincronización VTEX, pagos).
- Escaneos de vulnerabilidades de contenedores en cada build.
- Revisiones de código por pares obligatorias, con checklist de seguridad.

## Roadmap de seguridad
- Implementar detección de anomalías en comisiones (Machine Learning) en fases futuras.
- Evaluar integración con SIEM corporativo.
- Habilitar DLP para información bancaria exportada.
