FROM node:20-alpine
WORKDIR /app
COPY package*.json yarn.lock ./
RUN yarn install --production
COPY . .
RUN yarn run tsc
CMD ["node", "dist/index.js"]
