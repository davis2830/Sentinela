interface RedirectNoticeProps {
  location: string;
  endpoint: string;
  statusCode?: number;
  onUseAddress: (address: string) => void;
}

// Location is untrusted: display it as text and only copy HTTP(S) URLs into
// the form. Testing/saving still goes through the backend's public-IP checks.
export default function RedirectNotice({ location, endpoint, statusCode, onUseAddress }: RedirectNoticeProps) {
  let address: string | null = null;
  try {
    const parsed = new URL(location, endpoint);
    if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) address = parsed.href;
  } catch { /* A malformed Location is useful diagnostic text, not an actionable URL. */ }

  return (
    <div className="mt-2 space-y-2 text-xs text-text-muted">
      <p>La dirección que ingresaste envía a los visitantes a otra página. Sentinel aún no ha comprobado esa página.</p>
      <p className="break-all"><span className="font-semibold text-text-main">Dirección indicada por el sitio: </span>{address || location}</p>
      {address && <>
        <button type="button" onClick={() => onUseAddress(address!)} className="rounded-lg border border-amber-400/40 px-3 py-2 font-semibold text-amber-200 hover:bg-amber-400/10">Usar esta dirección</button>
        <p>Esto solo cambia el campo. Después pulsa «Probar en Vivo» para comprobar la nueva dirección.</p>
      </>}
      <details className="pt-1">
        <summary className="cursor-pointer text-text-muted">Detalles técnicos</summary>
        <p className="mt-2">HTTP {statusCode}. No se siguió la redirección automáticamente por seguridad.</p>
      </details>
    </div>
  );
}
