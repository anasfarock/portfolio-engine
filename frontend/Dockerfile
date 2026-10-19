# -----------------------------------------------------------
# Base Stage: Install node dependencies
# -----------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm install

# -----------------------------------------------------------
# Dev Stage: Live development server with Hot Module Reload
# -----------------------------------------------------------
FROM base AS dev
WORKDIR /app
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------
# Build Stage: Compile production bundle
# -----------------------------------------------------------
FROM base AS build
WORKDIR /app
COPY . .
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# -----------------------------------------------------------
# Production Stage: Serve static build with Nginx
# -----------------------------------------------------------
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
