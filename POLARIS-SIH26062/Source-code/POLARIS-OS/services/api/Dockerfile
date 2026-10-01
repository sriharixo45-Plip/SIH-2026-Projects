FROM node:22-bookworm-slim
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY services/api/package.json ./services/api/package.json
COPY apps/hq-dashboard/package.json ./apps/hq-dashboard/package.json
RUN npm ci
COPY services/api ./services/api
WORKDIR /workspace/services/api
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
