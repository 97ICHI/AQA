FROM node:22-bookworm
WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium
COPY . .
RUN npm run lint && npm run typecheck
CMD ["npm", "test"]
