FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
COPY chapters ./chapters
RUN mkdir -p /app/state && chown -R node:node /app
USER node
EXPOSE 5699
ENV PORT=5699 HOST=0.0.0.0 STATE_DIR=/app/state NODE_ENV=production
CMD ["node","server.js"]
