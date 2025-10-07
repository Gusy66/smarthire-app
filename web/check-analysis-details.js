const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function checkAnalysisDetails() {
  console.log('🔍 Verificando detalhes das análises...');
  
  try {
    const { data: analyses, error } = await supabase
      .from('stage_ai_runs')
      .select('id, run_id, status, result, finished_at, created_at')
      .eq('type', 'evaluate')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (error) {
      console.error('❌ Erro ao buscar análises:', error.message);
      return;
    }
    
    if (analyses && analyses.length > 0) {
      console.log(`✅ ${analyses.length} análises encontradas:`);
      analyses.forEach((analysis, index) => {
        console.log(`   ${index + 1}. Run ID: ${analysis.run_id}`);
        console.log(`      Status: ${analysis.status}`);
        console.log(`      Resultado: ${analysis.result ? 'Disponível' : 'Não disponível'}`);
        console.log(`      Criado em: ${analysis.created_at}`);
        console.log(`      Finalizado em: ${analysis.finished_at || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Nenhuma análise encontrada.');
    }
  } catch (e) {
    console.error('❌ Erro inesperado:', e.message);
  }
}

checkAnalysisDetails();
