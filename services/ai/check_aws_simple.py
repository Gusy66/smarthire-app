#!/usr/bin/env python3
"""
Script simples para verificar deployment AWS
"""

import subprocess
import json

def run_command(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout.strip()
    except Exception as e:
        return f"Erro: {e}"

def check_aws():
    print("=== VERIFICACAO AWS DEPLOYMENT ===")

    # 1. Verificar credenciais
    print("\n1. Verificando AWS CLI...")
    identity = run_command("aws sts get-caller-identity")
    if "Erro" in identity:
        print("   [ERRO] AWS CLI nao configurado")
        return
    print("   [OK] AWS CLI configurado")

    # 2. Verificar ECR
    print("\n2. Verificando repositorio ECR...")
    repos = run_command("aws ecr describe-repositories --repository-names smarthire-ai --region us-east-1")
    if "Erro" in repos:
        print("   [ERRO] Repositorio ECR nao encontrado")
        return
    print("   [OK] Repositorio ECR encontrado")

    # 3. Verificar imagens
    images = run_command("aws ecr list-images --repository-name smarthire-ai --region us-east-1")
    if "Erro" in images:
        print("   [ERRO] Nao foi possivel listar imagens")
        return
    print("   [OK] Imagens encontradas")

    # 4. Verificar cluster ECS
    print("\n3. Verificando cluster ECS...")
    cluster = run_command("aws ecs describe-cluster --cluster smarthire-cluster --region us-east-1")
    if "Erro" in cluster:
        print("   [ERRO] Cluster ECS nao encontrado")
        return
    print("   [OK] Cluster ECS encontrado")

    # 5. Verificar servico ECS
    print("\n4. Verificando servico ECS...")
    service = run_command("aws ecs describe-services --cluster smarthire-cluster --services smarthire-ai-service --region us-east-1")
    if "Erro" in service:
        print("   [ERRO] Servico ECS nao encontrado")
        return
    print("   [OK] Servico ECS encontrado")

    # 6. Verificar tarefas
    print("\n5. Verificando tarefas ECS...")
    tasks = run_command("aws ecs list-tasks --cluster smarthire-cluster --service-name smarthire-ai-service --region us-east-1")
    if "Erro" in tasks:
        print("   [ERRO] Nao foi possivel listar tarefas")
        return
    print("   [OK] Tarefas encontradas")

    # 7. Verificar logs
    print("\n6. Verificando logs recentes...")
    logs = run_command("aws logs tail /ecs/smarthire-ai --max-items 5 --region us-east-1")
    if "Erro" in logs:
        print("   [AVISO] Nao foi possivel obter logs")
    else:
        print("   [OK] Logs obtidos")

    print("\n=== RESUMO ===")
    print("Se tudo estiver OK acima, o problema pode ser:")
    print("   - Variaveis de ambiente nao configuradas")
    print("   - Problemas de conectividade com servicos externos")
    print("   - Configuracoes especificas do ambiente de producao")

if __name__ == "__main__":
    check_aws()

