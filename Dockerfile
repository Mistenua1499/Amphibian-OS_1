# ============================================================
# AMPHIBIAN OS - Imagen de produccion
# Node 22 (necesario para node:sqlite nativo)
# ============================================================
FROM node:22-alpine

WORKDIR /app

# Instalar dependencias (cache-friendly)
COPY package.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install

# Copiar codigo y compilar la PWA
COPY . .
RUN npm run build

# La DB vive en /data (montar volumen persistente aqui)
ENV DATABASE_URL="file:/data/amphibian.db"
ENV PORT=4000
RUN mkdir -p /data

EXPOSE 4000
# Seed corre solo si la DB esta vacia (idempotente), luego arranca
CMD ["sh", "-c", "npm run seed && npm start"]
