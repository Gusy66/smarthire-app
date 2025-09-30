## Contratos de API — BFF (Next.js)

### Convenções
- Autenticação: header `Authorization: Bearer <token> (Supabase)`
- Formato: `application/json`
- Paginação: `page`, `page_size` (default 20), `next_cursor` opcional
- Correlação: header `X-Request-Id` (gerado no BFF se ausente)
- Erros: `{ "error": { "code": string, "message": string, "details"?: any } }`

### Rotas — Vagas e Candidatos
POST /api/jobs
Request: `{ "title": string, "description"?: string, "location"?: string, "status"?: "open"|"closed" }`
Response: `{ "id": string }`

GET /api/jobs?search=&page=&page_size=
Response: `{ "items": Job[], "page": number, "page_size": number, "total": number }`

POST /api/candidates
Request: `{ "name": string, "email": string, "phone"?: string }`
Response: `{ "id": string }`

POST /api/applications
Request: `{ "candidate_id": string, "job_id": string }`
Response: `{ "id": string }`

### Rotas — Entrevistas e Calendário
POST /api/interviews
Request: `{ "application_id": string, "scheduled_at": string (ISO), "duration_minutes": number }`
Response: `{ "id": string }`

GET /api/interviews?from=&to=&page=&page_size=
Response: `{ "items": Interview[], ...pagination }`

### Uploads (URLs assinadas — via Supabase)
POST /api/uploads/resume
Request: `{ "filename": string, "content_type": string }`
Response: `{ "upload_url": string, "path": string }`

POST /api/uploads/audio
Request: `{ "filename": string, "content_type": string }`
Response: `{ "upload_url": string, "path": string }`

### IA — Transcrição, RAG e Score (timeout 30s)
POST /api/ai/transcribe
Request: `{ "audio_path": string, "language"?: string }`
Response (sync): `{ "run_id": string, "status": "succeeded", "transcript_path": string }`
Response (async): `{ "run_id": string, "status": "pending" }`

POST /api/ai/rag
Request: `{ "candidate_id": string, "questions": string[], "context": { "resume_path"?: string, "transcript_path"?: string } }`
Response: `{ "run_id": string, "status": "succeeded"|"pending", "answers"?: Answer[] }`

POST /api/ai/score
Request: `{ "interview_id": string, "template_id": string }`
Response: `{ "run_id": string, "status": "succeeded"|"pending", "scores"?: Score[] }`

GET /api/ai/runs/:id
Response: `{ "id": string, "type": "transcribe"|"rag"|"score", "status": "pending"|"running"|"succeeded"|"failed", "progress"?: number, "error"?: string }`

### Scores — Override manual
POST /api/scores/:interview_id/override
Request: `{ "question_id": string, "value": number, "reason"?: string }`
Response: `{ "id": string, "source": "manual", "value": number }`

### Templates
GET /api/templates?version?=&page=&page_size=
Response: `{ "items": Template[], ...pagination }`

POST /api/templates
Request: `{ "name": string, "version": number, "questions": { "text": string, "weight"?: number }[] }`
Response: `{ "id": string }`

### Analytics e Export
GET /api/analytics/summary?job_id?=&from?=&to?=
Response: `{ "time_to_hire_days": number, "interviews_count": number, "avg_score": number }`

POST /api/exports
Request: `{ "type": "jobs"|"candidates"|"analytics", "filters"?: any }`
Response: `{ "export_id": string, "status": "pending" }`

GET /api/exports/:id
Response: `{ "id": string, "status": "pending"|"succeeded"|"failed", "download_url"?: string }`

### Configurações
GET /api/settings
PUT /api/settings/profile
PUT /api/settings/company
PUT /api/settings/notifications
PUT /api/settings/ai
PUT /api/settings/security/2fa


