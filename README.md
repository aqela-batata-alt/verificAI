# verificAI — Fake Eyes (backend)

Backend Django do **Fake Eyes**, sistema de apoio à avaliação de notícias em
português, consumindo o modelo **BERTimbau V4 (chunking)**.

Plano de entrega por etapas: [TASKS.md](TASKS.md).

```text
verificAI/
├── apura/                      # Backend Django
│   ├── manage.py
│   ├── apura/                  # settings, urls, wsgi
│   └── analysis/               # App de análise (API v1, regras, fatiamento)
│       ├── api/                # API REST v1 (views, serializers, erros)
│       ├── services/           # classifier, preprocessing, risk, pipeline
│       ├── rules/rules_v1.json # Pesos e limiares versionados
│       └── tests/
├── frontend/                   # Interface Web (React 19 + Vite 8)
│   ├── src/                    # Componentes, páginas, domínio, estado, estilos
│   ├── public/                 # Favicons, manifesto e robôs
│   ├── deploy/                 # Configuração Nginx e cabeçalhos de segurança
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── bert_fakenews_v4/           # Pesos do modelo (model.safetensors via Git LFS)
├── docker-compose.yml          # Orquestração (db, web, nginx/frontend)
├── Dockerfile                  # Imagem do backend Django
├── requirements.txt            # Dependências Python
└── .env.example
```

---

## Gerenciamento de Arquivos Grandes (Git LFS)

O arquivo de pesos do modelo (`bert_fakenews_v4/model.safetensors`, ~436 MB) excede o limite tradicional de 100 MB do GitHub e é rastreado via **Git LFS (Large File Storage)** através do arquivo `.gitattributes`.

### Clonando com Git LFS

Ao clonar o repositório a partir do GitHub, certifique-se de ter o Git LFS instalado:

```bash
# 1. Instalar o Git LFS no sistema (se ainda não tiver)
# macOS: brew install git-lfs
# Ubuntu/Debian: sudo apt install git-lfs

# 2. Inicializar o Git LFS
git lfs install

# 3. Baixar os pesos binários rastreados
git lfs pull
```

> **Fallback Inteligente:** Se o repositório for clonado sem Git LFS (onde `model.safetensors` é apenas um ponteiro de texto de ~130 bytes), o backend detecta isso automaticamente e baixa os pesos diretamente do **Hugging Face Hub** (`oficialmarlon/bertimbau-fakenews-detector-v4`), mantendo tudo funcional sem erros.

---

## Rodando localmente (sem Docker)

### 1. Back end (Django + BERTimbau)
```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # ajuste DJANGO_SECRET_KEY
cd apura
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py runserver
```

O modelo é carregado de `bert_fakenews_v4/` (via Git LFS). Se a pasta contiver apenas o ponteiro LFS ou não existir, o download é feito automaticamente do Hugging Face Hub. Em Apple Silicon (Mac M1/M2/M3/M4), a inferência usa aceleração de hardware Metal (MPS) automaticamente.

### 2. Front end (React 19 + Vite 8)
```bash
cd frontend
npm ci
npm run dev                   # http://localhost:5173
```
O servidor de desenvolvimento do Vite repassa as chamadas de `/api` diretamente para o Django (`http://localhost:8000`).

---

## Rodando com Docker (Full-Stack)

```bash
cp .env.example .env          # defina DJANGO_SECRET_KEY e DJANGO_DEBUG=false
docker compose up -d --build
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
docker compose exec web python manage.py collectstatic --no-input
```

A aplicação completa estará acessível em **`http://localhost`**:
* **`/`**: Interface web (SPA React servida pelo Nginx).
* **`/api/`**: API Django REST Framework.
* **`/admin/`**: Painel administrativo do Django.
* **`/static/`**: Arquivos estáticos do Django.

---

## API v1

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/v1/health/?load=1` | Status, versões e informações do modelo |
| `POST` | `/api/v1/analyses/` | Executa uma análise (texto) |
| `GET` | `/api/v1/analyses/<id>/` | Recupera resultado e versões usadas |

**Requisição**

```json
{
  "input_type": "text",
  "title": "URGENTE: Nova substância milagrosa cura todas as doenças em 24h!",
  "subtitle": "Médicos tentam esconder a receita secreta da população.",
  "text": "Compartilhe imediatamente antes que derrubem este artigo..."
}
```

`title` e `subtitle` são opcionais; o texto completo deve ter entre 50 e 5.000
caracteres. Entrada por `url` retorna `501` até a Etapa 2.

**Resposta (resumo)**

```json
{
  "id": "uuid",
  "status": {"code": "alto_risco", "label": "Alto risco"},
  "risk_index": 94.09,
  "claim": {"summary": "..."},
  "explanation": ["..."],
  "abstention": [],
  "evidence": {"enabled": false, "sources": []},
  "indicators": {"...": "..."},
  "model": {"label": "falsa", "fake_probability": 0.998, "chunks_analyzed": 1},
  "risk": {"formula": "100 * sum(w_i * s_i) / sum(w_i)", "signals_missing": ["evidence_conflict"]},
  "limitations": ["..."],
  "recommendations": ["..."],
  "versions": {"model": "...", "model_sha256": "...", "rules": "...", "calibrator": "...", "schema": "...", "code": "..."}
}
```

Status possíveis: `poucos_sinais_de_risco` (0–25), `requer_atencao` (>25–60),
`alto_risco` (>60–100) e `analise_inconclusiva` (tem prioridade; sem índice).

**Erros** seguem sempre o formato:

```json
{"error": {"code": "text_too_short", "message": "...", "action": "...", "field": "text"}}
```

---

## Testes Automatizados

### Back end (Django)
```bash
cd apura
../.venv/bin/python manage.py test analysis                    # rápido (modelo simulado)
RUN_MODEL_TESTS=1 ../.venv/bin/python manage.py test analysis  # inclui o modelo real
```

### Front end (React / Vitest)
```bash
cd frontend
npm test               # roda os 808 testes automatizados
npm run check          # lint + typecheck + testes + build de produção
```
