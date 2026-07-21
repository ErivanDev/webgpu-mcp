FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build


FROM nginx:alpine

RUN apk add --no-cache openssl

RUN mkdir -p /etc/nginx/ssl && \
    openssl req \
      -x509 \
      -nodes \
      -days 3650 \
      -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/server.key \
      -out /etc/nginx/ssl/server.crt \
      -subj "/CN=10.101.53.244"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]