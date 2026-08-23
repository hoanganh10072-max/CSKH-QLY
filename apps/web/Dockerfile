FROM node:22-alpine AS deps
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace @cskh/web --include-workspace-root

COPY apps/web apps/web
WORKDIR /app/apps/web
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
