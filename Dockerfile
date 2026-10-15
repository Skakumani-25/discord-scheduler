FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate && npm run build
COPY --from=client-build /app/client/dist /app/client/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]