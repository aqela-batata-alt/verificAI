# verificAI

```text
meu-projeto/
├── apura/               # Código-fonte da aplicação Django
│   ├── manage.py
│   └── apura/           # Módulo principal do projeto
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── nginx/
    └── default.conf

```

---

### 1. `docker-compose.yml`

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: apura_db
    restart: always
    environment:
      POSTGRES_DB: apura_db
      POSTGRES_USER: apura_user
      POSTGRES_PASSWORD: apura_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  web:
    build: .
    container_name: apura_web
    restart: always
    command: gunicorn apura.wsgi:application --bind 0.0.0.0:8000
    volumes:
      - .:/code
      - static_volume:/code/static
      - media_volume:/code/media
    expose:
      - "8000"
    environment:
      - DB_ENGINE=django.db.backends.postgresql
      - DB_NAME=apura_db
      - DB_USER=apura_user
      - DB_PASSWORD=apura_password
      - DB_HOST=db
      - DB_PORT=5432
    depends_on:
      - db

  nginx:
    image: nginx:alpine
    container_name: apura_nginx
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx:/etc/nginx/conf.d
      - static_volume:/code/static
      - media_volume:/code/media
    depends_on:
      - web

volumes:
  postgres_data:
  static_volume:
  media_volume:

```

---

### 2. `Dockerfile`

Crie um arquivo chamado **`Dockerfile`** no diretório raiz do projeto:

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /code

# Instala dependências do sistema necessárias para o PostgreSQL e compilações
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /code/
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . /code/

```

---

### 3. `requirements.txt`

Certifique-se de incluir as dependências básicas:

```text
Django>=4.2,<5.0
gunicorn>=21.0.0
psycopg2-binary>=2.9.0

```

---

### 4. `nginx/default.conf`

Crie a pasta `nginx` e dentro dela o arquivo `default.conf`:

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://web:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /code/static/;
    }

    location /media/ {
        alias /code/media/;
    }
}

```

---

### Comandos para Rodar o Projeto

1. **Subir os containers:**
```bash
docker compose up -d --build

```


2. **Criar as migrações do banco de dados:**
```bash
docker compose exec web python manage.py migrate

```


3. **Criar um superusuário admin:**
```bash
docker compose exec web python manage.py createsuperuser

```


4. **Coletar arquivos estáticos:**
```bash
docker compose exec web python manage.py collectstatic --no-input

```



A aplicação estará acessível em **`http://localhost`**.
