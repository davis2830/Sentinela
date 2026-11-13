ARG PYTHON_BASE=python:3.11-alpine@sha256:bb1d70c1df30d8ee1e05214dbe82d6cdfd29833c1f47ce917f20991aca93acaa
FROM ${PYTHON_BASE} AS runtime

LABEL maintainer="Sentinel NOC Team"
LABEL description="Senti9 — Agente privado de Sentinel, GcTechOps"
LABEL org.opencontainers.image.title="Senti9"
LABEL org.opencontainers.image.version="1.8.0"
LABEL org.opencontainers.image.vendor="GcTechOps"
LABEL org.opencontainers.image.url="https://sentinel.gctechops.com"
LABEL org.opencontainers.image.documentation="https://hub.docker.com/r/davis1924/senti9"

RUN apk upgrade --no-cache \
    && python -m pip uninstall --yes pip setuptools wheel \
    && addgroup -g 10001 senti9 && adduser -D -u 10001 -G senti9 senti9 \
    && mkdir /data && chown senti9:senti9 /data && chmod 700 /data

WORKDIR /app

COPY agent.py /app/agent.py
COPY common/*.py /app/common/
COPY delivery.py /app/delivery.py
COPY security.py /app/security.py
COPY diagnostics.py /app/diagnostics.py
COPY install.py /app/install.py

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
