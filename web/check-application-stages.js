const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function checkApplicationStages() {
  console.log('🔍 Verificando application_stages...');
  
  try {
    // Buscar application_stages
    const { data: appStages, error: appStagesError } = await supabase
      .from('application_stages')
      .select('*, applications(candidates(name)), job_stages(name)')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (appStagesError) {
      console.error('❌ Erro ao buscar application_stages:', appStagesError.message);
      return;
    }
    
    if (appStages && appStages.length > 0) {
      console.log(`✅ ${appStages.length} application_stages encontrados:`);
      appStages.forEach((stage, index) => {
        console.log(`   ${index + 1}. ID: ${stage.id}`);
        console.log(`      Application ID: ${stage.application_id}`);
        console.log(`      Stage ID: ${stage.stage_id}`);
        console.log(`      Status: ${stage.status}`);
        console.log(`      Candidato: ${stage.applications?.candidates?.name || 'N/A'}`);
        console.log(`      Etapa: ${stage.job_stages?.name || 'N/A'}`);
        console.log(`      Criado em: ${stage.created_at}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Nenhum application_stage encontrado.');
    }
    
    // Verificar se há análises para os application_stages encontrados
    if (appStages && appStages.length > 0) {
      console.log('🔍 Verificando análises para os application_stages...');
      
      for (const appStage of appStages) {
        const { data: analysis, error: analysisError } = await supabase
          .from('stage_ai_runs')
          .select('id, run_id, status, result, finished_at')
          .eq('application_stage_id', appStage.id)
          .eq('type', 'evaluate')
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (analysisError) {
          console.error(`❌ Erro ao buscar análise para application_stage ${appStage.id}:`, analysisError.message);
          continue;
        }
        
        if (analysis) {
          console.log(`   ✅ Análise encontrada para application_stage ${appStage.id}:`);
          console.log(`      Run ID: ${analysis.run_id}`);
          console.log(`      Status: ${analysis.status}`);
          console.log(`      Resultado: ${analysis.result ? 'Disponível' : 'Não disponível'}`);
          console.log(`      Finalizado em: ${analysis.finished_at}`);
        } else {
          console.log(`   ⚠️  Nenhuma análise encontrada para application_stage ${appStage.id}`);
        }
      }
    }
    
  } catch (e) {
    console.error('❌ Erro inesperado:', e.message);
  }
}

checkApplicationStages();
