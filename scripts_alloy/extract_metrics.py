import json
import os
import re
import sys

# Lista de palabras clave y funciones PromQL para ignorar en caso de búsqueda general
PROMQL_KEYWORDS = {
    "sum", "avg", "min", "max", "count", "rate", "irate", "increase",
    "histogram_quantile", "by", "without", "topk", "bottomk", "sort",
    "sort_desc", "clamp", "clamp_min", "clamp_max", "time", "delta",
    "deriv", "predict_linear", "resets", "changes", "label_replace",
    "label_join", "vector", "scalar", "bool", "offset", "or", "and", "unless"
}

def extract_expressions(data):
    """Extrae recursivamente todas las expresiones PromQL del JSON."""
    expressions = []
    
    if isinstance(data, dict):
        # Campos típicos donde Grafana almacena queries
        for key in ["expr", "query", "definition", "rawSql"]:
            if key in data and isinstance(data[key], str):
                expressions.append(data[key])
        
        for val in data.values():
            expressions.extend(extract_expressions(val))
            
    elif isinstance(data, list):
        for item in data:
            expressions.extend(extract_expressions(item))
            
    return expressions

def find_metrics(expressions, filter_prefix="windows_"):
    """Identifica nombres de métricas únicas a partir de las expresiones."""
    metrics = set()
    
    # Regex para capturar identificadores Prometheus válidos
    pattern = re.compile(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b')
    
    for expr in expressions:
        # Remover contenido dentro de etiquetas { ... } para evitar capturar nombres de labels
        cleaned_expr = re.sub(r'\{[^}]*\}', '', expr)
        
        matches = pattern.findall(cleaned_expr)
        for token in matches:
            if filter_prefix:
                if token.startswith(filter_prefix):
                    metrics.add(token)
            else:
                if token.lower() not in PROMQL_KEYWORDS and not token.isdigit():
                    metrics.add(token)
                    
    return sorted(metrics)

def main():
    file_path = sys.argv[1] if len(sys.argv) > 1 else "dashboard.json"
    
    if not os.path.exists(file_path):
        print(f"Error: No se encontró el archivo '{file_path}'.")
        print("Uso: python extract_metrics.py <nombre_archivo.json>")
        sys.exit(1)
        
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            dashboard_data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error al leer JSON: {e}")
            sys.exit(1)
            
    expressions = extract_expressions(dashboard_data)
    windows_metrics = find_metrics(expressions, filter_prefix="windows_")
    
    print("=" * 60)
    print(f"MÉTRICAS DE WINDOWS DETECTADAS ({len(windows_metrics)} encontradas):")
    print("=" * 60)
    for m in windows_metrics:
        print(f" - {m}")
        
    if windows_metrics:
        # Genera el regex formateado para copiar y pegar en Alloy
        alloy_regex = "(" + "|".join(windows_metrics) + ")"
        
        print("\n" + "=" * 60)
        print("REGEX LISTO PARA GRAFANA ALLOY (prometheus.relabel):")
        print("=" * 60)
        print(f'regex = "{alloy_regex}"\n')

if __name__ == "__main__":
    main()