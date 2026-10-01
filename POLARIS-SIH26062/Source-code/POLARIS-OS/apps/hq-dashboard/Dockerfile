FROM node:22-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY services/api/package.json ./services/api/package.json
COPY apps/hq-dashboard/package.json ./apps/hq-dashboard/package.json
RUN npm ci
COPY apps/hq-dashboard ./apps/hq-dashboard
WORKDIR /workspace/apps/hq-dashboard
RUN npm run build

FROM nginx:1.27-alpine
COPY apps/hq-dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/hq-dashboard/dist /usr/share/nginx/html
EXPOSE 80
