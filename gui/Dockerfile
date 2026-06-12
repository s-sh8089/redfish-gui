FROM node:24-alpine
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
EXPOSE 3008
CMD ["yarn", "dev"]
