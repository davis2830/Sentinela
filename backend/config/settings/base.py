import os
from datetime import timedelta
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
DEBUG = os.environ.get("DEBUG", "False").lower() in ("true", "1", "yes")
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,backend,sentinel_backend,host.docker.internal").split(",") if h.strip()]
TRUSTED_PROXY_CIDRS = [
    cidr.strip()
    for cidr in os.environ.get("TRUSTED_PROXY_CIDRS", "").split(",")
    if cidr.strip()
]
for h in ["[::1]", "::1", "host.docker.internal", "sentinel_backend"]:
    if h not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(h)


# Applications
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_celery_beat",
    "django_celery_results",
    # Local apps
    "common",
    "accounts",
    "organizations",
    "users",
    "monitoring",
    "ssl_monitor",
    "dns_monitor",
    "domain",
    "api_checks",
    "security_headers",
    "alerts",
    "notifications",
    "incidents",
    "reports",
    "status_page",
    "maintenance",
    "audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "common.middleware.IPAllowlistMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "sentinel"),
        "USER": os.environ.get("POSTGRES_USER", "sentinel"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "sentinel"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
        "CONN_HEALTH_CHECKS": True,
    }
}

# Caches (Distributed Redis DB 2 with Authentication Support)
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = os.environ.get("REDIS_PORT", "6379")
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "").strip()

if REDIS_PASSWORD:
    _redis_auth = f":{REDIS_PASSWORD}@"
else:
    _redis_auth = ""

REDIS_BASE_URL = f"redis://{_redis_auth}{REDIS_HOST}:{REDIS_PORT}"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.environ.get(
            "REDIS_CACHE_URL", f"{REDIS_BASE_URL}/2"
        ),
        "TIMEOUT": 300,
        "KEY_PREFIX": "sentinel",
    }
}


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Custom user model
AUTH_USER_MODEL = "accounts.User"

# Internationalization
LANGUAGE_CODE = "es-es"
TIME_ZONE = os.environ.get("TIME_ZONE", "America/Guatemala")
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.SentinelAPITokenAuthentication",
        "accounts.authentication.SentinelJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",
        "user": "300/minute",
    },
}

# SimpleJWT (Production Hardened: Token Rotation & Blacklisting)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", "15"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME_DAYS", "7"))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# Celery
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", f"{REDIS_BASE_URL}/0")
CELERY_RESULT_BACKEND = os.environ.get(
    "CELERY_RESULT_BACKEND", f"{REDIS_BASE_URL}/1"
)

CELERY_IMPORTS = (
    "monitoring.tasks",
    "ssl_monitor.tasks",
    "dns_monitor.tasks",
    "domain.tasks",
    "api_checks.tasks",
    "security_headers.tasks",
    "alerts.tasks",
    "notifications.tasks",
    "incidents.tasks",
    "reports.tasks",
)

# Celery Performance & Reliability
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_IGNORE_RESULT = True
CELERY_RESULT_EXPIRES = 1800

# Celery Dedicated Task Queues
CELERY_TASK_DEFAULT_QUEUE = "celery"
CELERY_TASK_ROUTES = {
    "alerts.*": {"queue": "high_priority"},
    "notifications.*": {"queue": "high_priority"},
    "monitoring.run_check": {"queue": "monitoring"},
    "api_checks.*": {"queue": "monitoring"},
    "ssl_monitor.*": {"queue": "background"},
    "dns_monitor.*": {"queue": "background"},
    "domain.*": {"queue": "background"},
    "security_headers.*": {"queue": "background"},
    "reports.*": {"queue": "background"},
}

CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_BEAT_SCHEDULE = {
    "identity-outbox": {"task": "accounts.dispatch_identity_mail", "schedule": 60.0},
    "evaluate-alert-rules-every-30s": {
        "task": "alerts.evaluate_rules",
        "schedule": 30.0,
    },
    "run-api-checks-every-30s": {
        "task": "api_checks.run_all",
        "schedule": 30.0,
    },
    "run-monitoring-checks-every-30s": {
        "task": "monitoring.check_all",
        "schedule": 30.0,
    },
    "run-ssl-checks-every-5m": {
        "task": "ssl_monitor.scan_all",
        "schedule": 300.0,
    },
    "run-dns-checks-every-5m": {
        "task": "dns.scan_all",
        "schedule": 300.0,
    },
    "run-domain-checks-every-1h": {
        "task": "domain.scan_all",
        "schedule": 3600.0,
    },
    "run-security-headers-checks-every-1h": {
        "task": "security_headers.scan_all",
        "schedule": 3600.0,
    },
    "check-expired-trials-every-15m": {
        "task": "organizations.check_expired_trials",
        "schedule": 900.0,
    },
    "check-sentinine-heartbeats-every-60s": {
        "task": "monitoring.check_sentinine_heartbeats",
        "schedule": 60.0,
    },
    "purge-telemetry-every-sunday": {
        "task": "monitoring.purge_telemetry",
        "schedule": 86400.0 * 7,  # Every 7 days
    },
}


# CORS
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = False

# Blackbox Exporter
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "").strip() or ("http://localhost:3001" if DEBUG else "")
TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "")
TURNSTILE_SITE_KEY = os.environ.get("TURNSTILE_SITE_KEY", "")
TURNSTILE_HOSTNAMES = [v.strip() for v in os.environ.get("TURNSTILE_HOSTNAMES", "").split(",") if v.strip()]
ENFORCE_LEGACY_EMAIL_VERIFICATION = os.environ.get("ENFORCE_LEGACY_EMAIL_VERIFICATION", "false").lower() == "true"
EMAIL_RESEND_COOLDOWN_SECONDS = int(os.environ.get("EMAIL_RESEND_COOLDOWN_SECONDS", "60"))
EMAIL_RESEND_DAILY_LIMIT = int(os.environ.get("EMAIL_RESEND_DAILY_LIMIT", "5"))
BETA_GLOBAL_SCANS_PER_MINUTE = int(os.environ.get("BETA_GLOBAL_SCANS_PER_MINUTE", "120"))
BETA_MAX_PENDING_SCANS = int(os.environ.get("BETA_MAX_PENDING_SCANS", "60"))
BETA_EMAIL_DOMAIN_ALLOWLIST = [v.strip().lower() for v in os.environ.get("BETA_EMAIL_DOMAIN_ALLOWLIST", "").split(",") if v.strip()]
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Sentinel <no-reply@example.invalid>")

# Blackbox Exporter
BLACKBOX_EXPORTER_URL = os.environ.get("BLACKBOX_EXPORTER_URL", "http://blackbox_exporter:9115")

# Sentry Error Tracking & Performance Monitoring (AppSec & Meta-Observability)
SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.redis import RedisIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[
                DjangoIntegration(),
                CeleryIntegration(),
                RedisIntegration(),
            ],
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            profiles_sample_rate=float(os.environ.get("SENTRY_PROFILES_SAMPLE_RATE", "0.05")),
            send_default_pii=False,
            environment=os.environ.get("SENTINEL_ENV", "production" if not DEBUG else "development"),
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Unable to initialize Sentry SDK: %s", exc)


# Logging Configuration & Log Sanitization (ISO 27001 / SOC 2 Compliance)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "mask_sensitive_data": {
            "()": "common.logging.SensitiveDataMaskingFilter",
        },
    },
    "formatters": {
        "standard": {
            "format": "[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)s]: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "filters": ["mask_sensitive_data"],
            "formatter": "standard",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.environ.get("LOG_LEVEL", "INFO"),
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "sentinel": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
}


