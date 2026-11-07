# NetShield production image: builds the frontend, then runs one uvicorn process that serves the API
# and the built frontend from the same origin (NETSHIELD_STATIC_DIR).
# Not built or run in the development environment of this project (Docker was not installed there);
# the same production setup is tested without Docker by `npm --prefix frontend run test:e2e:prod`.

FROM node:24-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
COPY frontend/tools/package.json frontend/tools/package-lock.json ./tools/
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.14-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NETSHIELD_STATIC_DIR=/app/frontend/dist
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist /app/frontend/dist
RUN useradd --create-home netshield
USER netshield
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
