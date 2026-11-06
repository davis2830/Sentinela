FROM python:3.13-alpine

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates openssl whois

COPY requirements/ /app/requirements/

RUN pip install --upgrade pip \
    && pip install -r requirements/base.txt \
    && python -m pip check \
    && python -m pip uninstall -y pip

COPY . /app/

RUN addgroup -g 10001 sentinel \
    && adduser -D -u 10001 -G sentinel sentinel \
    && mkdir -p /app/staticfiles \
    && chown sentinel:sentinel /app/staticfiles

USER 10001:10001

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/', timeout=4).read()" || exit 1

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--reload"]
