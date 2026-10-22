FROM python:3.11-alpine AS runtime

LABEL maintainer="Sentinel NOC Team"
LABEL description="Senti9 — Agente privado de Sentinel, GcTechOps"
LABEL org.opencontainers.image.title="Senti9"
LABEL org.opencontainers.image.version="1.7.0"
LABEL org.opencontainers.image.vendor="GcTechOps"

RUN addgroup -g 10001 senti9 && adduser -D -u 10001 -G senti9 senti9 \
    && mkdir /data && chown senti9:senti9 /data && chmod 700 /data

WORKDIR /app

COPY agent.py /app/agent.py
COPY common /app/common
COPY delivery.py /app/delivery.py
COPY security.py /app/security.py

ENV PYTHONUNBUFFERED=1
ENV POLL_INTERVAL=10
ENV SENTININE_INSECURE_SKIP_VERIFY=false
ENV SENTININE_STATE_DIR=/data
ENV SENTININE_ENV=production
ENV PYTHONDONTWRITEBYTECODE=1
VOLUME ["/data"]
USER 10001:10001

CMD ["python", "agent.py"]

FROM runtime AS tests
USER root
RUN apk add --no-cache openssl
COPY test_*.py /app/
COPY release.py /app/release.py
USER 10001:10001
CMD ["python", "-m", "unittest", "discover", "-v"]

FROM runtime AS production
