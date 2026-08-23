FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace @cskh/api --include-workspace-root

COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
