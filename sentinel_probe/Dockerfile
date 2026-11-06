FROM python:3.11-alpine

# Legacy entry point; build from repository root:
# docker build -f sentinel_probe/Dockerfile .
LABEL maintainer="Sentinel NOC Team"
LABEL description="Sentinel Satellite Private Probe Agent for On-Premise Monitoring"

WORKDIR /app

RUN addgroup -g 10001 senti9 && adduser -D -u 10001 -G senti9 senti9 \
    && mkdir /data && chown senti9:senti9 /data && chmod 700 /data
COPY sentinine/agent.py sentinine/delivery.py sentinine/security.py /app/
COPY sentinine/common /app/common

ENV PYTHONUNBUFFERED=1
ENV POLL_INTERVAL=10
ENV SENTININE_STATE_DIR=/data
ENV SENTININE_ENV=production
ENV PYTHONDONTWRITEBYTECODE=1
VOLUME ["/data"]
USER 10001:10001

CMD ["python", "agent.py"]
