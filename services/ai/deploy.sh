#!/bin/bash

# Script de deployment para AWS ECS
# Uso: ./deploy.sh [tag]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configurações
REPOSITORY_NAME="smarthire-ai"
REGION="us-east-1"
CLUSTER_NAME="smarthire-cluster"
SERVICE_NAME="smarthire-ai-service"
IMAGE_TAG=${1:-"latest"}

echo -e "${GREEN}🚀 Iniciando deployment do SmartHire AI Service${NC}"

# Verificar se AWS CLI está configurado
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI não está configurado. Execute 'aws configure' primeiro.${NC}"
    exit 1
fi

# Fazer login no ECR
echo -e "${YELLOW}🔐 Fazendo login no ECR...${NC}"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin 352499225750.dkr.ecr.$REGION.amazonaws.com

# Build da imagem
echo -e "${YELLOW}🏗️  Fazendo build da imagem...${NC}"
docker build -t $REPOSITORY_NAME:$IMAGE_TAG .

# Tag para ECR
echo -e "${YELLOW}🏷️  Aplicando tags para ECR...${NC}"
docker tag $REPOSITORY_NAME:$IMAGE_TAG 352499225750.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME:$IMAGE_TAG

# Push para ECR
echo -e "${YELLOW}⬆️  Fazendo push para ECR...${NC}"
docker push 352499225750.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME:$IMAGE_TAG

echo -e "${GREEN}✅ Build e push concluídos com sucesso!${NC}"

# Verificar se cluster existe, senão criar
echo -e "${YELLOW}🔍 Verificando cluster ECS...${NC}"
if ! aws ecs describe-cluster --cluster $CLUSTER_NAME >/dev/null 2>&1; then
    echo -e "${YELLOW}🏗️  Criando cluster ECS...${NC}"
    aws ecs create-cluster --cluster-name $CLUSTER_NAME
fi

# Verificar se serviço existe, senão criar
echo -e "${YELLOW}🔍 Verificando serviço ECS...${NC}"
if ! aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME >/dev/null 2>&1; then
    echo -e "${YELLOW}📋 Criando definição de tarefa...${NC}"

    # Criar definição de tarefa
    cat > task-definition.json << EOF
{
    "family": "smarthire-ai-task",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "256",
    "memory": "512",
    "executionRoleArn": "arn:aws:iam::352499225750:role/ecsTaskExecutionRole",
    "taskRoleArn": "arn:aws:iam::352499225750:role/ecsTaskExecutionRole",
    "containerDefinitions": [
        {
            "name": "smarthire-ai",
            "image": "352499225750.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:${IMAGE_TAG}",
            "essential": true,
            "portMappings": [
                {
                    "containerPort": 8000,
                    "protocol": "tcp"
                }
            ],
            "healthCheck": {
                "command": [
                    "CMD-SHELL",
                    "curl -f http://localhost:8000/health || exit 1"
                ],
                "interval": 30,
                "timeout": 10,
                "startPeriod": 60,
                "retries": 3
            },
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/smarthire-ai",
                    "awslogs-region": "${REGION}",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        }
    ]
}
EOF

    aws ecs register-task-definition --cli-input-json file://task-definition.json

    echo -e "${YELLOW}🌐 Criando serviço ECS...${NC}"
    # Criar serviço (assume que já existe VPC e subnets configuradas)
    aws ecs create-service \
        --cluster $CLUSTER_NAME \
        --service-name $SERVICE_NAME \
        --task-definition smarthire-ai-task \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[subnet-12345678,subnet-87654321],securityGroups=[sg-12345678],assignPublicIp=ENABLED}" \
        --load-balancers "targetGroupArn=tg-12345678,containerName=smarthire-ai,containerPort=8000"
else
    echo -e "${YELLOW}🔄 Atualizando serviço ECS...${NC}"
    # Atualizar serviço existente
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition smarthire-ai-task \
        --force-new-deployment
fi

echo -e "${GREEN}✅ Deployment iniciado com sucesso!${NC}"
echo -e "${YELLOW}📊 Para verificar o status:${NC}"
echo "aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME"
echo "aws logs tail /ecs/smarthire-ai --follow"

# Cleanup
rm -f task-definition.json
