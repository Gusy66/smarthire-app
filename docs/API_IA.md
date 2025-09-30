## Contratos de API — Serviço de IA (FastAPI)

### Segurança e Convenções
- Autorização entre serviços via JWT de serviço (issuer=BFF), escopo por rota.
- Formato: `application/json`. Idempotência via header `Idempotency-Key`.
- Correlação: `X-Request-Id`. Logs com trace/span ids (OTel).

### Transcrição
POST /v1/transcribe
Request: `{ "audio_path": string, "language"?: string, "tenant_id": string }`
Response: `{ "run_id": string, "status": "running" }`
Processo: worker chama Deepgram → salva transcrição em `transcripts/` → atualiza `ai_runs` no DB.

### RAG (Perguntas e Respostas com Contexto)
POST /v1/rag
Request: `{ "candidate_id": string, "questions": string[], "context": { "resume_path"?: string, "transcript_path"?: string }, "tenant_id": string }`
Response: `{ "run_id": string, "status": "running" }`
Processo: gera embeddings (pgvector), busca contexto, chama LLM, persiste respostas.

### Scoring (Checklist por Template)
POST /v1/score
Request: `{ "interview_id": string, "template_id": string, "tenant_id": string }`
Response: `{ "run_id": string, "status": "running" }`
Processo: aplica pesos/heurísticas, chama LLM quando necessário, grava `scores`.

### Status de Execução
GET /v1/runs/:id
Response: `{ "id": string, "type": "transcribe"|"rag"|"score", "status": "pending"|"running"|"succeeded"|"failed", "progress"?: number, "error"?: string }`

### Webhooks (opcional pós-MVP)
POST /v1/webhooks/run-status  (assinatura HMAC)
Payload: `{ "run_id": string, "status": string, "updated_at": string }`

### Limites e Retries
- Retries exponenciais (máx 3) para provedores externos (ASR/LLM).
- Circuit breaker após taxa de erro elevada.
- Rate limiting por `tenant_id`.


