FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/hf-cache

WORKDIR /code

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /code/
# torch CPU (evita baixar as bibliotecas CUDA, ~2 GB a menos)
RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch \
    && pip install -r requirements.txt

COPY . /code/

WORKDIR /code/apura
EXPOSE 8000

# 1 worker por contêiner (o modelo ocupa ~450 MB por processo) com threads.
CMD ["gunicorn", "apura.wsgi:application", "--bind", "0.0.0.0:8000", \
     "--workers", "1", "--threads", "4", "--timeout", "60"]
