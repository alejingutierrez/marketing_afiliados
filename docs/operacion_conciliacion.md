# Operación de conciliación y manejo de discrepancias

## Objetivo
Garantizar la concordancia entre los pedidos y comisiones registrados en la plataforma y los datos oficiales provenientes de VTEX, identificando y resolviendo discrepancias con trazabilidad completa.

## Actores
- **Gestor de Afiliados:** monitorea conciliaciones y coordina con marcas.
- **Finance:** valida montos confirmados y procesa pagos.
- **Admin Marca:** revisa resultados por su marca/campaña.
- **Auditor:** revisa logs y resoluciones.

## Fuentes de información
1. **Webhooks VTEX** (eventos en near-real-time): `order.created`, `order.invoiced/paid`, `order.canceled/returned`.
2. **Reporte diario VTEX**: exportación CSV/JSON con pedidos y estados finales.
3. **Registro interno**: tablas `order`, `commission_transaction`, `influencer_balance`.
4. **Logs de webhooks**: tabla `webhook_delivery_log` con status y reintentos.

## Calendario de procesos
- **Conciliación diaria** (automática, ejecutada a las 03:00 a.m.).
- **Reporte quincenal** (días 1 y 16) para cierre de comisiones confirmadas.
- **Conciliación ad-hoc** cuando se detectan alertas o incidentes VTEX.

## Flujo de conciliación diaria
1. **Extracción de datos**
   - Worker descarga reporte VTEX del día anterior (API/FTP).
   - Se normalizan datos y se guardan en staging (`vtex_report_staging`).
2. **Comparación automática**
   - Se cruza cada pedido del reporte con registros internos por `order_id`.
   - Se valida estado actual, montos, SKUs elegibles y códigos aplicados.
3. **Clasificación de discrepancias**
   - **Tipo A – Pedido faltante:** existe en VTEX pero no en sistema → disparar re-procesamiento.
   - **Tipo B – Estado divergente:** estado diferente (p. ej. VTEX `paid`, sistema `created`).
   - **Tipo C – Monto discrepante:** diferencia en total elegible o comisión calculada (>1%).
   - **Tipo D – Código no reconocido:** pedido con cupón no registrado.
4. **Resolución automática**
   - Intento de re-procesamiento de webhooks (requeue) para Tipo A/D.
   - Recalcular comisiones para Tipo B/C si la data VTEX es consistente.
5. **Generación de reporte**
   - Se crea registro en `reconciliation_log` con:
     - fecha de corrida
     - totales procesados
     - número de discrepancias por tipo
     - pedidos ajustados automáticamente
     - pendientes manuales
   - Se genera archivo CSV/JSON con pendientes manuales y se almacena en S3.
6. **Notificaciones**
   - Email a Gestor + Finance + Admin Marca con resumen.
   - Alertas críticas (Tipo C/D sin resolver) vía canal dedicado.

## Proceso manual de discrepancias
1. Gestor revisa dashboard de discrepancias pendientes.
2. Acciones posibles:
   - Reintentar sincronización (botón “Reprocesar”).
   - Ajustar manualmente un pedido (requiere rol Admin Dentsu o Finance, genera entrada en `audit_log`).
   - Marcar discrepancia como aceptada (justificación obligatoria).
3. Una vez resuelto, se actualiza estado y se adjunta evidencia (capturas/reportes).

## Corte quincenal
1. Worker ejecuta job que:
   - Identifica comisiones en estado `estimated` cuyo pedido no tuvo devoluciones en ventana configurada.
   - Cambia estado a `confirmed`, actualiza saldos y tiers.
   - Genera reporte consolidado por marca/campaña.
2. Finance valida resumen y autoriza cambios. Cualquier bloqueo debe registrarse con razón.
3. Emails automáticos a influencers con resumen de comisiones confirmadas.

## Manejo de reversas
- Al recibir evento de cancelación/devolución dentro de ventana, se crea transacción `reverted` que descuenta saldo.
- Si saldo queda negativo, se refleja en panel y se registra bandera para futuras solicitudes de retiro.
- Se notifica al influencer y al Gestor para seguimiento.

## Métricas y KPIs
- `% de pedidos conciliados automáticamente` (objetivo > 95%).
- `Tiempo promedio de resolución de discrepancias Tipo A-D`.
- `Número de alertas críticas sin resolver >24h`.
- `Reversas fuera de ventana` (indicador de posibles fraudes o errores).

## Herramientas de soporte
- Dashboard Grafana “Conciliación” con: pedidos procesados, discrepancias por tipo, latencia de webhooks.
- Integración con canal de alertas (email/Slack) para errores críticos.

## Escalamiento
- Discrepancias >3 días sin resolver → escalamiento a Admin Dentsu.
- Problemas recurrentes con una marca → reunión semanal con Admin Marca.
- Fallas persistentes de webhooks → contacto con soporte VTEX y registro en runbook de incidentes.

## Documentación relacionada
- `docs/arquitectura.md` (flujos VTEX y workers).
- `docs/modelo_datos.md` (tablas `order`, `commission_transaction`, `reconciliation_log`).
- `docs/seguridad_cumplimiento.md` (controles sobre datos y accesos durante la conciliación).
