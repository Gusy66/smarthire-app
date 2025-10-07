const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function checkLatestAnalysis() {
  console.log('🔍 Verificando análise mais recente...');
  
  try {
    // Buscar a análise mais recente
    const { data: latestAnalysis, error } = await supabase
      .from('stage_ai_runs')
      .select('id, run_id, status, result, finished_at, created_at, application_stage_id')
      .eq('type', 'evaluate')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('❌ Erro ao buscar análise:', error.message);
      return;
    }
    
    console.log('✅ Análise mais recente encontrada:');
    console.log(`   Run ID: ${latestAnalysis.run_id}`);
    console.log(`   Status: ${latestAnalysis.status}`);
    console.log(`   Application Stage ID: ${latestAnalysis.application_stage_id}`);
    console.log(`   Criado em: ${latestAnalysis.created_at}`);
    console.log(`   Finalizado em: ${latestAnalysis.finished_at || 'NULL'}`);
    console.log(`   Resultado: ${latestAnalysis.result ? 'Disponível' : 'Não disponível'}`);
    
    if (latestAnalysis.result) {
      console.log('\n📊 Conteúdo do resultado:');
      console.log(JSON.stringify(latestAnalysis.result, null, 2));
    }
    
    // Verificar se existe application_stage para este run
    const { data: appStage, error: appStageError } = await supabase
      .from('application_stages')
      .select('id, application_id, stage_id, status')
      .eq('id', latestAnalysis.application_stage_id)
      .single();
    
    if (appStageError) {
      console.error('❌ Erro ao buscar application_stage:', appStageError.message);
    } else {
      console.log('\n🔗 Application Stage relacionado:');
      console.log(`   ID: ${appStage.id}`);
      console.log(`   Application ID: ${appStage.application_id}`);
      console.log(`   Stage ID: ${appStage.stage_id}`);
      console.log(`   Status: ${appStage.status}`);
    }
    
  } catch (e) {
    console.error('❌ Erro inesperado:', e.message);
  }
}

checkLatestAnalysis();
