FROM node:24-slim
WORKDIR /app
COPY api/package.json api/package-lock.json ./api/
RUN cd api && npm ci --omit=dev
COPY api/tsconfig.json ./api/
COPY api/src ./api/src
COPY shared ./shared
RUN chown -R node:node /app
USER node
ENV NODE_ENV=production
CMD ["node", "api/src/index.ts"]
