FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN chown -R node:node /app
USER node
ENV NODE_ENV=production
CMD ["node", "src/index.ts"]
