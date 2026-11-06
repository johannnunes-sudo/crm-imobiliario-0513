# Imagem de produção do CRM Porto Florêncio (Render / qualquer host com Docker)
FROM oven/bun:1.3

WORKDIR /app
COPY . .

RUN bun install
RUN cd packages/web && bunx vite build

ENV NODE_ENV=production
# O Render define PORT; o servidor lê essa variável.
CMD ["sh", "-c", "cd packages/web && bun src/migrate.ts && bun src/__server.ts"]
