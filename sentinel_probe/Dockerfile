FROM python:3.11-alpine

LABEL maintainer="Sentinel NOC Team"
LABEL description="Sentinel Satellite Private Probe Agent for On-Premise Monitoring"

WORKDIR /app

COPY agent.py /app/agent.py

ENV PYTHONUNBUFFERED=1
ENV POLL_INTERVAL=10

CMD ["python", "agent.py"]
