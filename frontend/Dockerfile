# Stage 1: Build React SPA
FROM node:18-alpine AS build-stage

WORKDIR /workspace

COPY package*.json ./
RUN npm install --legacy-peer-deps

ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY . .
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:stable-alpine

COPY --from=build-stage /workspace/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
