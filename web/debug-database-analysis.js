const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function debugDatabaseAnalysis() {
  console.log('🔍 Debug completo do banco de dados para análise...\n');
  
  const stageId = '5e2cff7e-d470-410b-952b-2f83c75bdc84';
  const applicationId = '0dd08781-5983-42ce-b6a0-5de3106a0581';
  
  console.log(`📋 Parâmetros de busca:`);
  console.log(`   Stage ID: ${stageId}`);
  console.log(`   Application ID: ${applicationId}\n`);
  
  try {
    // 1. Verificar se existe application_stage para esta combinação
    console.log('1️⃣ Verificando application_stages...');
    const { data: appStages, error: appStagesError } = await supabase
      .from('application_stages')
      .select('id, application_id, stage_id, status, created_at')
      .eq('application_id', applicationId)
      .eq('stage_id', stageId);
    
    if (appStagesError) {
      console.error('❌ Erro ao buscar application_stages:', appStagesError.message);
      return;
    }
    
    if (appStages && appStages.length > 0) {
      console.log(`✅ ${appStages.length} application_stage(s) encontrado(s):`);
      appStages.forEach((stage, index) => {
        console.log(`   ${index + 1}. ID: ${stage.id}`);
        console.log(`      Application ID: ${stage.application_id}`);
        console.log(`      Stage ID: ${stage.stage_id}`);
        console.log(`      Status: ${stage.status}`);
        console.log(`      Criado em: ${stage.created_at}`);
      });
    } else {
      console.log('❌ Nenhum application_stage encontrado para esta combinação!');
      console.log('   Isso explica por que a análise não aparece.');
      return;
    }
    
    // 2. Para cada application_stage encontrado, buscar análises
    console.log('\n2️⃣ Verificando análises para cada application_stage...');
    
    for (const appStage of appStages) {
      console.log(`\n   🔍 Buscando análises para application_stage: ${appStage.id}`);
      
      const { data: analyses, error: analysesError } = await supabase
        .from('stage_ai_runs')
        .select('id, run_id, result, status, finished_at, created_at, type')
        .eq('application_stage_id', appStage.id)
        .eq('type', 'evaluate')
        .order('created_at', { ascending: false });
      
      if (analysesError) {
        console.error(`   ❌ Erro ao buscar análises:`, analysesError.message);
        continue;
      }
      
      if (analyses && analyses.length > 0) {
        console.log(`   ✅ ${analyses.length} análise(s) encontrada(s):`);
        analyses.forEach((analysis, index) => {
          console.log(`      ${index + 1}. Run ID: ${analysis.run_id}`);
          console.log(`         Status: ${analysis.status}`);
          console.log(`         Tipo: ${analysis.type}`);
          console.log(`         Resultado: ${analysis.result ? 'Disponível' : 'Não disponível'}`);
          console.log(`         Criado em: ${analysis.created_at}`);
          console.log(`         Finalizado em: ${analysis.finished_at || 'NULL'}`);
          
          if (analysis.result) {
            console.log(`         Score: ${analysis.result.score || 'N/A'}`);
            console.log(`         Análise: ${analysis.result.analysis ? analysis.result.analysis.substring(0, 100) + '...' : 'N/A'}`);
          }
        });
      } else {
        console.log(`   ⚠️  Nenhuma análise encontrada para application_stage ${appStage.id}`);
      }
    }
    
    // 3. Simular a query exata do endpoint
    console.log('\n3️⃣ Simulando query exata do endpoint...');
    
    const firstAppStage = appStages[0];
    console.log(`   Usando application_stage_id: ${firstAppStage.id}`);
    
    const { data: analysis, error: analysisError } = await supabase
      .from('stage_ai_runs')
      .select(`
        id,
        run_id,
        result,
        status,
        finished_at,
        created_at
      `)
      .eq('application_stage_id', firstAppStage.id)
      .eq('type', 'evaluate')
      .eq('status', 'succeeded')
      .not('result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (analysisError) {
      console.error('   ❌ Erro na query do endpoint:', analysisError.message);
    } else if (analysis) {
      console.log('   ✅ Query do endpoint retornou análise:');
      console.log(`      ID: ${analysis.id}`);
      console.log(`      Run ID: ${analysis.run_id}`);
      console.log(`      Status: ${analysis.status}`);
      console.log(`      Resultado: ${analysis.result ? 'Disponível' : 'Não disponível'}`);
      console.log(`      Criado em: ${analysis.created_at}`);
      console.log(`      Finalizado em: ${analysis.finished_at || 'NULL'}`);
    } else {
      console.log('   ❌ Query do endpoint não retornou nenhuma análise!');
      console.log('   Isso explica por que o endpoint retorna null.');
    }
    
    // 4. Verificar dados relacionados
    console.log('\n4️⃣ Verificando dados relacionados...');
    
    // Buscar candidato
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, name, email')
      .eq('id', '0b0effa4-11c6-4e02-8aee-96ea36530b43')
      .single();
    
    if (candidateError) {
      console.error('   ❌ Erro ao buscar candidato:', candidateError.message);
    } else {
      console.log('   ✅ Candidato encontrado:');
      console.log(`      ID: ${candidate.id}`);
      console.log(`      Nome: ${candidate.name}`);
      console.log(`      Email: ${candidate.email}`);
    }
    
    // Buscar etapa
    const { data: stage, error: stageError } = await supabase
      .from('job_stages')
      .select('id, name, description')
      .eq('id', stageId)
      .single();
    
    if (stageError) {
      console.error('   ❌ Erro ao buscar etapa:', stageError.message);
    } else {
      console.log('   ✅ Etapa encontrada:');
      console.log(`      ID: ${stage.id}`);
      console.log(`      Nome: ${stage.name}`);
      console.log(`      Descrição: ${stage.description ? stage.description.substring(0, 100) + '...' : 'N/A'}`);
    }
    
  } catch (e) {
    console.error('❌ Erro inesperado:', e.message);
  }
}

debugDatabaseAnalysis();
