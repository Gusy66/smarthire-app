# SmartHire AI Service

Serviço de IA para processamento de áudio, transcrição e avaliação de candidatos.

## 🚀 Como Iniciar

### Opção 1: Desenvolvimento (Recomendado)
```bash
# Usar ambiente virtual Python
.\start_dev.bat
```

**Vantagens:**
- ✅ Hot reload automático
- ✅ Debugging mais fácil
- ✅ Desenvolvimento mais rápido
- ✅ Menos uso de recursos

### Opção 2: Docker
```bash
# Usar container Docker
.\start_docker.bat
```

**Vantagens:**
- ✅ Ambiente isolado
- ✅ Consistente entre máquinas
- ✅ Fácil deploy
- ✅ Dependências garantidas

## 📋 Pré-requisitos

### Para Desenvolvimento:
- Python 3.10+
- Ambiente virtual ativado
- Dependências instaladas (`pip install -r requirements.txt`)

### Para Docker:
- Docker instalado
- Imagem construída (`docker build -t smarthire-ai:dev .`)

## 🌐 URLs Disponíveis

- **API Base:** http://localhost:8000
- **Documentação:** http://localhost:8000/docs
- **Saúde:** http://localhost:8000/health
- **Transcrição:** POST http://localhost:8000/v1/transcribe
- **Status:** GET http://localhost:8000/v1/runs/{id}

## 🔧 Comandos Úteis

```bash
# Ativar ambiente virtual
.venv\Scripts\Activate.ps1

# Instalar dependências
pip install -r requirements.txt

# Testar importação
python -c "import main"

# Construir imagem Docker
docker build -t smarthire-ai:dev .

# Ver containers rodando
docker ps

# Parar containers
docker stop $(docker ps -q --filter ancestor=smarthire-ai:dev)
```

## 📁 Estrutura

```
services/ai/
├── main.py              # Aplicação FastAPI
├── requirements.txt     # Dependências Python
├── Dockerfile          # Configuração Docker
├── start_dev.bat       # Script desenvolvimento
├── start_docker.bat    # Script Docker
└── README.md           # Este arquivo
```
