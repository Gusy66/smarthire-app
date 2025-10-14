#!/usr/bin/env python3
"""
Script para verificar o status do deployment na AWS
e diagnosticar problemas comuns em produção
"""

import subprocess
import json
import sys
from typing import Dict, Any

# Configurações da AWS
AWS_CONFIG = {
    "region": "us-east-1",
    "account_id": "352499225750",
    "cluster_name": "smarthire-cluster",
    "service_name": "smarthire-ai-service",
    "repository_name": "smarthire-ai",
    "log_group": "/ecs/smarthire-ai"
}

def run_aws_command(command: list) -> Dict[str, Any]:
    """Executa comando AWS CLI e retorna resultado como dict"""
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro ao executar comando: {' '.join(command)}")
        print(f"Erro: {e.stderr}")
        return {}
    except json.JSONDecodeError:
        print(f"❌ Erro ao parsear JSON do comando: {' '.join(command)}")
        return {}

def check_aws_credentials():
    """Verifica se AWS CLI está configurado"""
    print("[CREDENCIAIS] Verificando credenciais AWS...")
    result = run_aws_command(["aws", "sts", "get-caller-identity"])

    if result:
        print(f"[OK] AWS CLI configurado - Account: {result.get('Account', 'N/A')}")
        return True
    else:
        print("❌ AWS CLI não configurado. Execute: aws configure")
        return False

def check_ecr_repository():
    """Verifica se repositório ECR existe e tem imagens"""
    print(f"\n📦 Verificando repositório ECR: {AWS_CONFIG['repository_name']}...")

    # Listar repositórios
    repos = run_aws_command([
        "aws", "ecr", "describe-repositories",
        "--repository-names", AWS_CONFIG['repository_name'],
        "--region", AWS_CONFIG['region']
    ])

    if not repos.get('repositories'):
        print(f"❌ Repositório ECR '{AWS_CONFIG['repository_name']}' não encontrado")
        return False

    # Verificar imagens
    images = run_aws_command([
        "aws", "ecr", "list-images",
        "--repository-name", AWS_CONFIG['repository_name'],
        "--region", AWS_CONFIG['region']
    ])

    image_count = len(images.get('imageIds', []))
    print(f"✅ Repositório ECR encontrado com {image_count} imagens")

    if image_count == 0:
        print("⚠️  Nenhuma imagem encontrada no repositório")
        return False

    return True

def check_ecs_cluster():
    """Verifica se cluster ECS existe"""
    print(f"\n🏗️  Verificando cluster ECS: {AWS_CONFIG['cluster_name']}...")

    cluster = run_aws_command([
        "aws", "ecs", "describe-cluster",
        "--cluster", AWS_CONFIG['cluster_name'],
        "--region", AWS_CONFIG['region']
    ])

    if not cluster.get('clusters'):
        print(f"❌ Cluster ECS '{AWS_CONFIG['cluster_name']}' não encontrado")
        return False

    cluster_info = cluster['clusters'][0]
    status = cluster_info.get('status', 'UNKNOWN')
    print(f"✅ Cluster ECS encontrado - Status: {status}")

    return True

def check_ecs_service():
    """Verifica serviço ECS e suas tarefas"""
    print(f"\n🌐 Verificando serviço ECS: {AWS_CONFIG['service_name']}...")

    services = run_aws_command([
        "aws", "ecs", "describe-services",
        "--cluster", AWS_CONFIG['cluster_name'],
        "--services", AWS_CONFIG['service_name'],
        "--region", AWS_CONFIG['region']
    ])

    if not services.get('services'):
        print(f"❌ Serviço ECS '{AWS_CONFIG['service_name']}' não encontrado")
        return False

    service = services['services'][0]
    desired_count = service.get('desiredCount', 0)
    running_count = service.get('runningCount', 0)
    status = service.get('status', 'UNKNOWN')

    print(f"✅ Serviço encontrado - Status: {status}")
    print(f"📊 Tarefas: {running_count}/{desired_count} rodando")

    if running_count < desired_count:
        print(f"⚠️  Apenas {running_count}/{desired_count} tarefas rodando")

        # Verificar tarefas específicas
        tasks = run_aws_command([
            "aws", "ecs", "list-tasks",
            "--cluster", AWS_CONFIG['cluster_name'],
            "--service-name", AWS_CONFIG['service_name'],
            "--region", AWS_CONFIG['region']
        ])

        if tasks.get('taskArns'):
            task_arn = tasks['taskArns'][0]
            print(f"🔍 Verificando tarefa: {task_arn.split('/')[-1]}")

            task_details = run_aws_command([
                "aws", "ecs", "describe-tasks",
                "--cluster", AWS_CONFIG['cluster_name'],
                "--tasks", task_arn,
                "--region", AWS_CONFIG['region']
            ])

            if task_details.get('tasks'):
                task = task_details['tasks'][0]
                task_status = task.get('lastStatus', 'UNKNOWN')
                print(f"📋 Status da tarefa: {task_status}")

                if task.get('stoppingAt') or task.get('stoppedAt'):
                    print("❌ Tarefa está parando/finalizada")

        return False

    return True

def check_cloudwatch_logs():
    """Verifica logs recentes no CloudWatch"""
    print(f"\n📜 Verificando logs recentes em: {AWS_CONFIG['log_group']}...")

    try:
        # Obter últimos eventos de log
        logs = run_aws_command([
            "aws", "logs", "describe-log-groups",
            "--log-group-name-prefix", AWS_CONFIG['log_group'].replace('/ecs/', ''),
            "--region", AWS_CONFIG['region']
        ])

        if not logs.get('logGroups'):
            print(f"❌ Log group '{AWS_CONFIG['log_group']}' não encontrado")
            return False

        print("✅ Log group encontrado")

        # Tentar obter últimos eventos
        try:
            recent_logs = subprocess.run([
                "aws", "logs", "tail", AWS_CONFIG['log_group'],
                "--max-items", "10",
                "--region", AWS_CONFIG['region']
            ], capture_output=True, text=True, timeout=10)

            if recent_logs.returncode == 0 and recent_logs.stdout.strip():
                print("📋 Últimos logs:")
                print("-" * 50)
                print(recent_logs.stdout)
                print("-" * 50)
            else:
                print("⚠️  Nenhum log recente encontrado ou erro na consulta")

        except subprocess.TimeoutExpired:
            print("⏱️  Timeout ao buscar logs (normal para serviços recém-iniciados)")

        return True

    except Exception as e:
        print(f"❌ Erro ao verificar logs: {e}")
        return False

def check_load_balancer():
    """Verifica se há load balancer configurado"""
    print("\n🔗 Verificando configurações de rede...")  # Verificar se há target groups associados ao serviço
    try:
        # Listar target groups
        targets = run_aws_command([
            "aws", "elbv2", "describe-target-groups",
            "--region", AWS_CONFIG['region']
        ])

        if targets.get('TargetGroups'):
            print(f"✅ Encontrados {len(targets['TargetGroups'])} target groups")

            # Verificar se algum está registrado com nosso serviço
            for tg in targets['TargetGroups']:
                tg_name = tg.get('TargetGroupName', '')
                if 'smarthire' in tg_name.lower():
                    print(f"🎯 Target Group relacionado encontrado: {tg_name}")
                    print(f"   Protocol: {tg.get('Protocol', 'N/A')}")
                    print(f"   Port: {tg.get('Port', 'N/A')}")
                    print(f"   VPC: {tg.get('VpcId', 'N/A')}")
        else:
            print("⚠️  Nenhum target group encontrado")

    except Exception as e:
        print(f"❌ Erro ao verificar rede: {e}")

def diagnose_production_issues():
    """Diagnóstico completo dos problemas em produção"""
    print("[DIAGNOSTICO] DIAGNOSTICO COMPLETO DO DEPLOYMENT AWS")
    print("=" * 60)

    issues = []

    # 1. Verificar credenciais AWS
    if not check_aws_credentials():
        issues.append("❌ AWS CLI não configurado")

    # 2. Verificar ECR
    if not check_ecr_repository():
        issues.append("❌ Problemas com repositório ECR")

    # 3. Verificar ECS Cluster
    if not check_ecs_cluster():
        issues.append("❌ Problemas com cluster ECS")

    # 4. Verificar ECS Service
    if not check_ecs_service():
        issues.append("❌ Problemas com serviço ECS")

    # 5. Verificar logs
    if not check_cloudwatch_logs():
        issues.append("❌ Problemas com logs CloudWatch")

    # 6. Verificar rede
    check_load_balancer()

    # Resumo
    print(f"\n{'=' * 60}")
    print("📋 RESUMO DO DIAGNÓSTICO")
    print("=" * 60)

    if not issues:
        print("✅ Todos os componentes estão funcionando corretamente!")
        print("🎯 Possíveis causas do problema em produção:")
        print("   • Variáveis de ambiente não configuradas corretamente")
        print("   • Problemas de conectividade com Supabase/OpenAI")
        print("   • Configurações específicas do ambiente de produção")
    else:
        print(f"❌ Encontrados {len(issues)} problemas:")
        for issue in issues:
            print(f"   {issue}")

    print("\n💡 DICAS PARA DEBUG:")
    print("   1. Verifique se as variáveis de ambiente estão definidas no ECS")
    print("   2. Confirme se o serviço consegue conectar com Supabase")
    print("   3. Verifique se a chave OpenAI está válida")
    print("   4. Analise os logs detalhados: aws logs tail /ecs/smarthire-ai --follow")

def main():
    """Função principal"""
    diagnose_production_issues()

if __name__ == "__main__":
    main()
