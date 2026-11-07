FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SOULARAB_ENV=production \
    SOULARAB_DATA_DIR=/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 appuser \
    && mkdir -p /data /usr/share/nginx/html \
    && chown -R appuser:appuser /data

WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"

CMD ["/bin/sh", "-c", "PORT=${PORT:-10000}; sed \"s/__PORT__/$PORT/g\" /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf; su -s /bin/sh appuser -c 'cd /app && exec uvicorn app.main:app --host 127.0.0.1 --port 8000' & exec nginx -g 'daemon off;'"]
