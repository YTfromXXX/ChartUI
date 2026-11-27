FROM python:3.11-slim

WORKDIR /app

# install only cure_api dependencies
COPY cure_api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# copy cure_api package + pool config
COPY cure_api/ ./cure_api/

EXPOSE 8700

# Railway sets $PORT automatically; fall back to 8700 locally
CMD uvicorn cure_api.server:app \
      --host 0.0.0.0 \
      --port ${PORT:-8700}
