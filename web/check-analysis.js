const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function checkAnalysis() {
  console.log('🔍 Verificando análises salvas...');
  
  try {
    const { data, error } = await supabase
      .from('stage_ai_runs')
      .select('*, application_stages(applications(candidates(name)))')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Erro ao buscar análises:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log(`✅ ${data.length} análises encontradas:`);
      data.forEach((run, index) => {
        console.log(`   ${index + 1}. Run ID: ${run.run_id}`);
        console.log(`      Status: ${run.status}`);
        console.log(`      Tipo: ${run.type}`);
        console.log(`      Candidato: ${run.application_stages?.applications?.candidates?.name || 'N/A'}`);
        console.log(`      Criado em: ${run.created_at}`);
        console.log(`      Resultado: ${run.result ? 'Disponível' : 'Não disponível'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Nenhuma análise encontrada.');
    }
  } catch (e) {
    console.error('❌ Erro inesperado:', e.message);
  }
}

checkAnalysis();
