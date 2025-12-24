# Multi-stage build para otimização
FROM python:3.12-slim as builder

# Instalar dependências de sistema necessárias para compilação
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar apenas requirements primeiro para cache de layers
COPY requirements.txt ./

# Criar venv em /opt/venv e instalar dependências do Python
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Stage final - apenas runtime
FROM python:3.12-slim

# Instalar dependências de runtime necessárias (inclui curl para healthcheck)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-por \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Configurar venv no PATH
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

# Copiar ambiente virtual com dependências
COPY --from=builder /opt/venv /opt/venv

# Copiar código fonte
COPY . .

# Criar usuário não-root para segurança
RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app
USER app

# Configurações de produção
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main_enhanced:app", "--host", "0.0.0.0", "--port", "8000", "--access-log"]
