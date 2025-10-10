# 🚀 Deployment do SmartHire AI Service na AWS

Este guia explica como fazer o deployment do serviço de IA na AWS usando ECS e ECR.

## 📋 Pré-requisitos

- AWS CLI configurado com credenciais apropriadas
- Docker instalado e rodando
- Acesso aos serviços AWS (ECR, ECS)
- VPC e subnets configuradas na AWS

## 🏗️ Passo 1: Build e Push da Imagem

```bash
# Navegar para o diretório do serviço
cd services/ai

# Build da imagem Docker
docker build -t smarthire-ai:latest .

# Login no ECR (substitua pela sua região e account ID)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 352499225750.dkr.ecr.us-east-1.amazonaws.com

# Tag da imagem para ECR
docker tag smarthire-ai:latest 352499225750.dkr.ecr.us-east-1.amazonaws.com/smarthire-ai:latest

# Push para ECR
docker push 352499225750.dkr.ecr.us-east-1.amazonaws.com/smarthire-ai:latest
```

## ⚙️ Passo 2: Configuração do ECS

### 2.1 Criar Cluster (se não existir)

```bash
aws ecs create-cluster --cluster-name smarthire-cluster
```

### 2.2 Criar Task Definition

```bash
# Criar arquivo de definição de tarefa
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
            "image": "352499225750.dkr.ecr.us-east-1.amazonaws.com/smarthire-ai:latest",
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
                    "awslogs-region": "us-east-1",
                    "awslogs-stream-prefix": "ecs"
                }
            },
            "environment": [
                {
                    "name": "OPENAI_API_KEY",
                    "value": "sua-chave-openai-aqui"
                },
                {
                    "name": "SUPABASE_URL",
                    "value": "https://seu-projeto.supabase.co"
                },
                {
                    "name": "SUPABASE_ANON_KEY",
                    "value": "sua-chave-anonima-aqui"
                },
                {
                    "name": "LOG_LEVEL",
                    "value": "INFO"
                }
            ]
        }
    ]
}
EOF

# Registrar a definição de tarefa
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### 2.3 Criar ou Atualizar Serviço

```bash
# Criar serviço (substitua pelos seus recursos da VPC)
aws ecs create-service \\
    --cluster smarthire-cluster \\
    --service-name smarthire-ai-service \\
    --task-definition smarthire-ai-task \\
    --desired-count 1 \\
    --launch-type FARGATE \\
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"

# OU atualizar serviço existente
aws ecs update-service \\
    --cluster smarthire-cluster \\
    --service smarthire-ai-service \\
    --task-definition smarthire-ai-task \\
    --force-new-deployment
```

## 🔧 Passo 3: Variáveis de Ambiente

Certifique-se de configurar as seguintes variáveis no container:

### Obrigatórias:
- `OPENAI_API_KEY`: Chave da API da OpenAI
- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase

### Opcionais:
- `PORT`: Porta do servidor (padrão: 8000)
- `WORKERS`: Número de workers (padrão: 4)
- `LOG_LEVEL`: Nível de logging (padrão: INFO)
- `ALLOWED_ORIGINS`: Origens permitidas para CORS

## 📊 Passo 4: Verificar Deployment

```bash
# Verificar status do serviço
aws ecs describe-services --cluster smarthire-cluster --services smarthire-ai-service

# Ver logs
aws logs tail /ecs/smarthire-ai --follow

# Ver tarefas rodando
aws ecs list-tasks --cluster smarthire-cluster

# Descrever tarefa específica
aws ecs describe-tasks --cluster smarthire-cluster --tasks <task-id>
```

## 🔗 URLs Disponíveis

Após o deployment:

- **API Base:** http://seu-load-balancer-endpoint:8000
- **Documentação:** http://seu-load-balancer-endpoint:8000/docs
- **Saúde:** http://seu-load-balancer-endpoint:8000/health
- **Transcrição:** POST http://seu-load-balancer-endpoint:8000/v1/transcribe
- **Avaliação:** POST http://seu-load-balancer-endpoint:8000/v1/evaluate
- **Status:** GET http://seu-load-balancer-endpoint:8000/v1/runs/{id}

## 🛠️ Solução de Problemas

### Problemas comuns:

1. **Task não inicia**: Verifique se a role IAM tem as permissões corretas
2. **Container crash**: Verifique logs com `aws logs tail /ecs/smarthire-ai`
3. **Network issues**: Verifique configurações de VPC e security groups
4. **Environment variables**: Certifique-se de que todas as variáveis obrigatórias estão definidas

### Logs úteis:

```bash
# Logs do serviço ECS
aws logs tail /ecs/smarthire-ai --follow

# Eventos do serviço
aws ecs describe-services --cluster smarthire-cluster --services smarthire-ai-service

# Métricas de CloudWatch (se configurado)
aws cloudwatch get-metric-statistics --namespace AWS/ECS --metric-name CPUUtilization --dimensions Name=ServiceName,Value=smarthire-ai-service
```

## 🔄 Atualizações

Para fazer atualizações:

1. Faça as alterações no código
2. Build e push nova imagem com nova tag
3. Atualize a task definition com a nova imagem
4. Force new deployment do serviço

```bash
# Exemplo de atualização
docker build -t smarthire-ai:v2 .
docker tag smarthire-ai:v2 352499225750.dkr.ecr.us-east-1.amazonaws.com/smarthire-ai:v2
docker push 352499225750.dkr.ecr.us-east-1.amazonaws.com/smarthire-ai:v2

# Atualizar task definition com nova imagem
# ... atualizar task-definition.json com nova tag ...
aws ecs register-task-definition --cli-input-json file://task-definition.json
aws ecs update-service --cluster smarthire-cluster --service smarthire-ai-service --task-definition smarthire-ai-task --force-new-deployment
```

## 🧹 Limpeza

Para remover recursos:

```bash
# Parar serviço
aws ecs update-service --cluster smarthire-cluster --service smarthire-ai-service --desired-count 0

# Deletar serviço
aws ecs delete-service --cluster smarthire-cluster --service smarthire-ai-service

# Deletar cluster
aws ecs delete-cluster --cluster smarthire-cluster
```

---

🎉 **Parabéns!** Seu serviço SmartHire AI está rodando na AWS!
