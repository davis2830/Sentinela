"""Bounded diagnostics for list responses; never expose raw exception text."""
import math


def check_presentation(check):
    details = check.details if isinstance(check.details, dict) else {}
    policy = details.get('evaluation_policy') or {}
    policy = policy if isinstance(policy, dict) else {}
    limit = policy.get('max_latency_ms')
    if isinstance(limit, bool) or not isinstance(limit, (int, float)) or not math.isfinite(limit) or limit <= 0:
        limit = None
    code = details.get('status_code')
    expected = policy.get('expected_status', details.get('expected_status'))
    diagnostic = None
    if check.status in ('down', 'error'):
        if isinstance(code, int) and not isinstance(code, bool) and 100 <= code <= 599:
            diagnostic = f'HTTP {code}'
            if isinstance(expected, int) and 100 <= expected <= 599:
                diagnostic += f' · esperado {expected}'
        else:
            errors = {
                'Timeout': 'Tiempo de espera agotado', 'ReadTimeout': 'Tiempo de espera agotado',
                'ConnectTimeout': 'Tiempo de espera agotado', 'TimeoutError': 'Tiempo de espera agotado',
                'ConnectionRefusedError': 'Conexión rechazada', 'ConnectionError': 'Fallo de conexión',
                'gaierror': 'Error de resolución DNS', 'SSLError': 'Fallo de conexión TLS',
            }
            error = details.get('error')
            diagnostic = errors.get(error) if isinstance(error, str) else None
            diagnostic = diagnostic or 'Comprobación fallida · ver detalle'
    elif check.status == 'slow':
        if limit is not None and isinstance(check.latency, (int, float)) and math.isfinite(check.latency) and check.latency > limit:
            excess = f'{check.latency - limit:.2f}'.rstrip('0').rstrip('.')
            diagnostic = f'Superó el límite por {excess} ms'
        else:
            diagnostic = 'Respuesta lenta registrada'
    return {'diagnostic': diagnostic, 'applied_max_latency_ms': limit}
