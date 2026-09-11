from .base import *  # noqa: F401,F403

DEBUG = True

# Allow browsable API in dev
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = (  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
)

# Ajuste de rate limits para benchmarking y pruebas de carga con k6
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["user"] = os.environ.get("THROTTLE_USER_RATE", "10000/minute")
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["anon"] = os.environ.get("THROTTLE_ANON_RATE", "5000/minute")