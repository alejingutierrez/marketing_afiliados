# Checklist manual de QA

Rellena una copia de esta tabla por ciclo de QA manual (pre-release, release candidate, hotfix). Todos los casos deben marcarse como `OK` o documentar incidencia (`FALLA`). Añade comentarios con referencias a tickets, capturas o logs.

| Caso | Rol responsable | Descripción | Resultado | Observaciones |
| --- | --- | --- | --- | --- |
| REG-01 | Influencer | Registro público completo con adjuntos y aceptación de políticas vigentes | | |
| REG-02 | Influencer | Intento de registro con datos duplicados rebate mensaje de error | | |
| AUT-01 | Admin Dentsu | Inicio de sesión con 2FA, rotación de contraseña y verificación de auditoría | | |
| GST-01 | Gestor | Aprobación de influencer pendiente y asignación de campaña | | |
| GST-02 | Gestor | Rechazo de influencer con motivo y notificación correspondiente | | |
| VTEX-01 | Gestor | Reprocesamiento de pedido faltante y verificación de reconciliación | | |
| VTEX-02 | Auditor | Revisión de reporte de conciliación diaria y alertas críticas | | |
| FIN-01 | Finance | Aprobación de solicitud de retiro y registro de pago con comprobante | | |
| FIN-02 | Finance | Registro de reversa posterior al pago y notificación al influencer | | |
| DASH-01 | Admin Marca | Revisión de métricas por marca y filtros de campaña | | |
| DASH-02 | Influencer | Visualización de dashboard personal y exportación de historial | | |
| SEC-01 | Auditor | Descarga de constancia de consentimiento y verificación de hash | | |
| SEC-02 | Operaciones | Ejecución manual de job de conciliación y revisión de logs/metrics | | |
| BCK-01 | Operaciones | Validación de backup generado por worker y restauración parcial | | |
| API-01 | QA | Revisión del portal de documentación y verificación de contratos críticos | | |
| PERF-01 | QA | Evaluación básica de performance (tiempos de respuesta < SLA) | | |
