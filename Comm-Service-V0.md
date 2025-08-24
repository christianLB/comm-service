# Comm-Service (v0.1)

## Objetivo

Centralizar la **comunicación bidireccional** entre el administrador y los microservicios del sistema (trading-service, financial-service, ai-service, memory-service).  
Debe permitir:

- **Enviar notificaciones** (Telegram, Email).
- **Recibir confirmaciones interactivas** (sí/no).
- **Ejecutar comandos administrativos** sobre servicios conectados.
- **Escalar gradualmente** hacia un bus de eventos sin perder simplicidad inicial.

---

## Alcance inicial (Fase 0)

- **Canales soportados**:

  - **Telegram** (bot con inline buttons para confirmación y `/cmd` para comandos).
  - **Email** (OTP + magic links para confirmación).

- **Funcionalidad mínima**:

  - Enviar mensajes con fallback entre canales.
  - Iniciar un comando (`/cmd` o vía API).
  - Solicitar confirmación sí/no.
  - Despachar comando a servicio objetivo vía HTTP.
  - Recibir respuesta o estado de ejecución.

- **Servicios destino**:
  - trading-service (principal beneficiario).
  - financial-service.
  - ai-service.
  - memory-service.

---

## API (mínima)

### `POST /v1/messages/send`

Enviar notificación a usuario o canal.

```json
{
  "channel": "telegram" | "email" | "auto",
  "template_key": "auth.otp",
  "data": { "name":"Christian", "otp":"843921" },
  "to": { "telegram_chat_id":123456789, "email":"c@example.com" },
  "require_confirmation": false,
  "routing": { "fallback":["email"], "ttl_seconds":300 }
}
POST /v1/commands/dispatch
Despachar un comando a un servicio.

json
Copiar
Editar
{
  "service":"trading-service",
  "action":"strategy.pause",
  "args":{ "strategy_id":"btc-arb-01" },
  "require_confirmation":true,
  "channel":"telegram"
}
Respuesta

json
Copiar
Editar
{ "command_id":"cmd_9x", "status":"pending_confirmation" }
POST /v1/verification/start
Iniciar flujo de verificación (OTP/magic link).

POST /v1/verification/confirm
Confirmar OTP o token recibido.

POST /v1/events
Entrada de eventos desde servicios externos (status de comando, outputs).

Ejemplo de confirmación (Telegram)
Admin ejecuta:

bash
Copiar
Editar
/cmd trading.strategy.pause strategy_id=btc-arb-01
comm-service responde con botones:
“¿Confirmás pausar estrategia btc-arb-01?” [Sí] [No]

Al hacer clic en Sí, comm-service envía POST /v1/commands al trading-service.

trading-service responde vía POST /v1/events.

comm-service actualiza estado y notifica al admin.

Seguridad
Telegram: allowlist de chat IDs (solo admins).

Email: enlaces firmados (JWS) con TTL corto.

Servicios ↔ comm-service: JWT servicio-a-servicio con audience específica.

Idempotency-Key en requests críticas.

Audit log: registro inmutable de cada acción confirmada.

Arquitectura inicial
comm-api (FastAPI/NestJS).

telegram-adapter (escucha updates del bot).

email-adapter (SMTP/Mailgun/SES).

Redis: almacenamiento de estado, idempotencia, colas ligeras.

Webhook dispatcher para notificar eventos a otros servicios.

Fases de implementación
Fase 0 — MVP
API mínima + adapters de Telegram y Email.

Confirmaciones sí/no.

Despacho de comandos vía HTTP.

Redis como backend de estado.

Fase 1 — Robustez
Reintentos con backoff.

Plantillas versionadas (i18n).

Preferencias por usuario.

Auditoría completa.

Fase 2 — Escalabilidad
Bus de eventos (Redis Streams / RabbitMQ).

Subscriptions commands.<service> y events.<service>.

Orquestación de flujos multi-paso.

Deploy inicial
docker-compose.yml

yaml
Copiar
Editar
version: "3.9"
services:
  comm-api:
    build: ./comm-api
    ports: [ "8080:8080" ]
    environment:
      - REDIS_URL=redis://redis:6379
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - ADMINS_TELEGRAM_IDS=123456789
      - SMTP_HOST=smtp.example.com
      - SMTP_USER=user
      - SMTP_PASS=pass
    depends_on: [ redis ]
  redis:
    image: redis:7-alpine
    volumes: [ "./data:/data" ]
Casos de uso iniciales
Trading-service:
“¿Confirmás pausar estrategia btc-arb-01?” → Sí → pausa → respuesta confirmada.

Financial-service:
“¿Publicar reporte mensual de julio?” [Sí/No].

Memory-service:
“¿Indexar 38 documentos nuevos de Bank/2025-08?” [Sí/No].

AI-service:
“¿Ampliar permisos de agente?” [Sí/No].

Próximos pasos
Generar skeleton del servicio con API + adapters.

Implementar flujo de confirmación sí/no en Telegram.

Exponer endpoints de dispatch y events.

Conectar primer servicio (trading-service).

yaml
Copiar
Editar

---

¿Querés que además te lo deje listo en **canvas** para que lo uses directamente como documento editable base del repo?
```
