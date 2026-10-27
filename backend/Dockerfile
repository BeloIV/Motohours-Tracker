FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Run as the image's unprivileged "node" user (uid 1000); uploads is a volume
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node

EXPOSE 3000

CMD ["node", "start.js"]
