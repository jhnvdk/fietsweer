FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json server.js ./
COPY lib ./lib
COPY public ./public
EXPOSE 8080
USER node
CMD ["npm", "start"]