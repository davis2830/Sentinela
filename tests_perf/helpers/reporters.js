/**
 * Helper para generar reporte HTML y resumen en consola al finalizar la prueba de k6.
 * Diseñado con el estilo visual y paleta de colores de Sentinel NOC.
 */
export function generateNOCSummary(data, title = 'Sentinel NOC - Reporte de Rendimiento') {
  const metrics = data.metrics;
  const duration = metrics.http_req_duration ? metrics.http_req_duration.values : {};
  const reqs = metrics.http_reqs ? metrics.http_reqs.values.count : 0;
  const rate = metrics.http_reqs ? metrics.http_reqs.values.rate.toFixed(2) : 0;
  const fails = metrics.http_req_failed ? (metrics.http_req_failed.values.rate * 100).toFixed(2) : 0;
  const checksPassed = metrics.checks ? metrics.checks.values.passes : 0;
  const checksFailed = metrics.checks ? metrics.checks.values.fails : 0;
  const totalChecks = checksPassed + checksFailed;
  const checksSuccessRate = totalChecks > 0 ? ((checksPassed / totalChecks) * 100).toFixed(1) : '100';

  const avgMs = duration.avg ? duration.avg.toFixed(2) : '0';
  const minMs = duration.min ? duration.min.toFixed(2) : '0';
  const medMs = duration.med ? duration.med.toFixed(2) : '0';
  const p90Ms = duration['p(90)'] ? duration['p(90)'].toFixed(2) : '0';
  const p95Ms = duration['p(95)'] ? duration['p(95)'].toFixed(2) : '0';
  const p99Ms = duration['p(99)'] ? duration['p(99)'].toFixed(2) : '0';
  const maxMs = duration.max ? duration.max.toFixed(2) : '0';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      background-color: #090D11;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 2rem;
    }
    .header {
      border-bottom: 1px solid #1E293B;
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .badge {
      background-color: rgba(16, 185, 129, 0.15);
      color: #10B981;
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 0.35rem 0.8rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .card {
      background-color: #111720;
      border: 1px solid #1E293B;
      border-radius: 1rem;
      padding: 1.25rem;
    }
    .card-title {
      font-size: 0.8rem;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .card-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #F8FAFC;
    }
    .card-sub {
      font-size: 0.8rem;
      color: #64748B;
      margin-top: 0.25rem;
    }
    .table-card {
      background-color: #111720;
      border: 1px solid #1E293B;
      border-radius: 1rem;
      overflow: hidden;
      margin-bottom: 2rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background-color: #17202C;
      padding: 0.85rem 1.25rem;
      color: #94A3B8;
      font-size: 0.85rem;
      font-weight: 600;
      border-bottom: 1px solid #1E293B;
    }
    td {
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid #1E293B;
      font-size: 0.9rem;
    }
    .text-emerald { color: #10B981; }
    .text-cyan { color: #06B6D4; }
    .text-amber { color: #F59E0B; }
    .text-rose { color: #EF4444; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin: 0 0 0.25rem 0; font-size: 1.6rem;">${title}</h1>
      <p style="margin: 0; color: #94A3B8; font-size: 0.9rem;">Prueba de rendimiento y validación de SLAs en Sentinel Platform</p>
    </div>
    <span class="badge">Grafana k6 Engine</span>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Peticiones Totales</div>
      <div class="card-value text-cyan">${reqs}</div>
      <div class="card-sub">${rate} req/s promedio</div>
    </div>
    <div class="card">
      <div class="card-title">Latencia p(95)</div>
      <div class="card-value ${parseFloat(p95Ms) < 300 ? 'text-emerald' : 'text-amber'}">${p95Ms} ms</div>
      <div class="card-sub">Objetivo SLA: &lt; 300 ms</div>
    </div>
    <div class="card">
      <div class="card-title">Tasa de Éxito de Checks</div>
      <div class="card-value ${parseFloat(checksSuccessRate) >= 99 ? 'text-emerald' : 'text-rose'}">${checksSuccessRate}%</div>
      <div class="card-sub">${checksPassed} pasados / ${checksFailed} fallidos</div>
    </div>
    <div class="card">
      <div class="card-title">Tasa de Error HTTP</div>
      <div class="card-value ${parseFloat(fails) < 1 ? 'text-emerald' : 'text-rose'}">${fails}%</div>
      <div class="card-sub">Objetivo SLA: &lt; 1%</div>
    </div>
  </div>

  <div class="table-card">
    <table>
      <thead>
        <tr>
          <th>Métrica de Latencia</th>
          <th>Valor</th>
          <th>Objetivo SLA</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Mínimo (min)</td>
          <td>${minMs} ms</td>
          <td>-</td>
          <td><span class="text-emerald">Pass</span></td>
        </tr>
        <tr>
          <td>Mediana (p50)</td>
          <td>${medMs} ms</td>
          <td>&lt; 150 ms</td>
          <td><span class="${parseFloat(medMs) < 150 ? 'text-emerald' : 'text-amber'}">${parseFloat(medMs) < 150 ? 'Pass' : 'Warning'}</span></td>
        </tr>
        <tr>
          <td>Promedio (avg)</td>
          <td>${avgMs} ms</td>
          <td>&lt; 200 ms</td>
          <td><span class="${parseFloat(avgMs) < 200 ? 'text-emerald' : 'text-amber'}">${parseFloat(avgMs) < 200 ? 'Pass' : 'Warning'}</span></td>
        </tr>
        <tr>
          <td>Percentil 90 (p90)</td>
          <td>${p90Ms} ms</td>
          <td>&lt; 250 ms</td>
          <td><span class="${parseFloat(p90Ms) < 250 ? 'text-emerald' : 'text-amber'}">${parseFloat(p90Ms) < 250 ? 'Pass' : 'Warning'}</span></td>
        </tr>
        <tr>
          <td>Percentil 95 (p95)</td>
          <td><strong>${p95Ms} ms</strong></td>
          <td>&lt; 300 ms</td>
          <td><span class="${parseFloat(p95Ms) < 300 ? 'text-emerald' : 'text-rose'}">${parseFloat(p95Ms) < 300 ? 'Pass' : 'Fail'}</span></td>
        </tr>
        <tr>
          <td>Percentil 99 (p99)</td>
          <td>${p99Ms} ms</td>
          <td>&lt; 500 ms</td>
          <td><span class="${parseFloat(p99Ms) < 500 ? 'text-emerald' : 'text-amber'}">${parseFloat(p99Ms) < 500 ? 'Pass' : 'Warning'}</span></td>
        </tr>
        <tr>
          <td>Máximo (max)</td>
          <td>${maxMs} ms</td>
          <td>-</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;

  return html;
}
