FROM nginx:1.30.6-alpine

RUN apk upgrade --no-cache \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/cache/nginx /var/run/nginx.pid
COPY nginx.conf /etc/nginx/nginx.conf

USER nginx
EXPOSE 80 443
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/nginx-health >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
