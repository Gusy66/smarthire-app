-- Adicionar campo para tipo de análise na etapa
-- Tipos: 'resume' (análise de currículo) ou 'transcript' (análise de transcrição)

ALTER TABLE job_stages 
ADD COLUMN IF NOT EXISTS analysis_type text 
CHECK (analysis_type IN ('resume', 'transcript')) 
DEFAULT 'resume';

-- Comentário explicativo
COMMENT ON COLUMN job_stages.analysis_type IS 'Tipo de análise da etapa: resume (currículo) ou transcript (transcrição de áudio/entrevista)';

