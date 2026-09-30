FROM python:3.11-alpine

LABEL maintainer="Sentinel NOC Team"
LABEL description="Sentinine — Private Watchdog & LAN Probe Agent for Sentinel NOC"

WORKDIR /app

COPY agent.py /app/agent.py

ENV PYTHONUNBUFFERED=1
ENV POLL_INTERVAL=10
ENV SENTININE_INSECURE_SKIP_VERIFY=false

CMD ["python", "agent.py"]
