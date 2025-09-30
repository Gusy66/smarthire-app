## Filas e Processamento Assíncrono (SQS)

### Filas
- `ai-transcription-queue` (DLQ: `ai-transcription-dlq`)
- `ai-rag-queue` (DLQ: `ai-rag-dlq`)
- `ai-score-queue` (DLQ: `ai-score-dlq`)
- `exports-queue` (DLQ: `exports-dlq`)

### Mensagens — Esquema base
```json
{
  "job_id": "uuid",
  "type": "transcription|rag|score|export",
  "tenant_id": "uuid",
  "payload": { "...": "..." },
  "request_id": "uuid",
  "created_at": "ISO-8601"
}
```

### Estados de Execução
- `pending` → `running` → `succeeded` | `failed`
- Progresso opcional (`0..100`), erros serializados em `ai_runs.error`.

### Timeouts e Retries
- Visibility timeout por tipo (ex.: 5–15 min). Retries exponenciais (máx 3) → DLQ.
- Idempotência por `job_id` em workers. Orquestração grava/atualiza `ai_runs`.

### Workers (FastAPI)
- Consumidores dedicados por fila (autoscaling por lag).
- Telemetria: logs estruturados, tracing OTel, métricas (processados/min, taxa de erro, custo/tokens).
- Segurança: mTLS/JWT entre worker e BFF/DB.

### Padrões de Observabilidade
- Correlacionar `request_id` do BFF com `job_id` e `ai_runs.id`.
- Alarmes: DLQ > 0, latência > SLO, custo/hora acima do threshold.


