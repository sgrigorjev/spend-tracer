FROM node:24-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY bot/package.json bot/package-lock.json ./bot/
RUN cd bot && npm ci --omit=dev
COPY bot/tsconfig.json ./bot/
COPY bot/src ./bot/src
COPY shared ./shared
RUN chown -R node:node /app
USER node
ENV NODE_ENV=production
CMD ["node", "bot/src/index.ts"]
