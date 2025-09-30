## Decisões de Plataforma (foco em escalabilidade)

### Nuvem e Serviços Gerenciados
- **Cloud principal**: AWS (região `us-east-1`) pela maturidade de rede, SQS, escalabilidade horizontal e ecossistema.
- **Banco e Storage**: Supabase gerenciado (Postgres + RLS + pgvector + Storage) como fonte única de verdade.
- **Filas e Jobs**: AWS SQS + DLQ; workers escaláveis no serviço de IA.
- **Observabilidade**: Sentry (erros), OpenTelemetry (tracing), CloudWatch (infra), dashboards de custo.

### Frontend e BFF
- **Frontend**: Next.js + React + TypeScript, deploy no Vercel (CDN global, SSR/ISR, zero-config scaling).
- **BFF**: API Routes do Next.js no Vercel para orquestração, auth e gateways de negócio leves.
  - Justificativa: latência baixa global, elasticidade automática, simplicidade de deploy.
  - Limites de execução resolvidos via fallback para jobs assíncronos em SQS.

### Serviço de IA (áudio, RAG, scoring)
- **Runtime**: FastAPI (Python) em AWS ECS Fargate (stateless, auto scaling) por controle fino de dependências e custo.
- **ASR (Transcrição)**: Deepgram (padrão) por escalabilidade e custo/latência previsíveis; fallback compatível com Whisper API.
- **LLM (RAG e scoring)**: Provedor compatível com API estilo OpenAI; modelo configurável por tenant (placeholder: "GPT5-mini").
  - Justificativa: abstrair fornecedor, permitir troca sem refatoração (Adapter pattern).

### Segurança
- **Auth**: Supabase Auth (e-mail, magic link, 2FA TOTP pós-MVP).
- **Autorização**: RBAC por `user_roles` e RLS por `company_id` no Postgres.
- **Segredos**: AWS Secrets Manager (chaves de IA/ASR), variáveis mínimas no Vercel.
- **Criptografia**: TLS in-transit; at-rest pelo provedor (Supabase/AWS).
- **LGPD**: classificação PII, retenção configurável, trilhas de auditoria (`audit_logs`).

### Estratégia de Timeout e Escalonamento
- **Timeout UI/BFF**: 30s. Se exceder, registrar `job` em SQS e retornar `job_id` + `status=pending`.
- **Processamento**: Workers FastAPI consumindo SQS com auto scaling por métricas (visibilidade/lag).
- **Comunicação UI**: Polling `GET /api/ai/runs/:id` (SSE/WebSocket pós-MVP).

### Padrões de Engenharia
- Circuit breaker e retries exponenciais nas integrações externas.
- Idempotência por `request_id` em operações de IA/Jobs.
- Logs estruturados com correlação (trace/span ids), métricas de custo por requisição/token.

### Roadmap de Infra
- MVP: Vercel (web+BFF), Supabase, ECS Fargate (IA), SQS + DLQ, Sentry.
- Pós-MVP: cache CDN custom, SSE/WebSocket, integrações de calendário externas, hardening LGPD.


