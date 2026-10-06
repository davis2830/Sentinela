import { useEffect, useRef } from 'react';

type Widget = {
  render: (node: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Widget } }

export default function Turnstile({ siteKey, action, onToken }: {
  siteKey: string; action: string; onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  useEffect(() => {
    if (!siteKey) return;
    let disposed = false;
    let widget: string | undefined;
    let script = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.dataset.turnstile = 'true';
      document.head.appendChild(script);
    }
    const mount = () => {
      if (disposed || widget || !container.current || !window.turnstile) return;
      widget = window.turnstile.render(container.current, {
        sitekey: siteKey, action, theme: 'dark',
        callback: (token: string) => callback.current(token),
        'expired-callback': () => callback.current(''),
        'error-callback': () => callback.current(''),
      });
    };
    script.addEventListener('load', mount);
    mount();
    return () => {
      disposed = true;
      script?.removeEventListener('load', mount);
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, action]);
  return <div ref={container} aria-label="Verificación de seguridad" className="overflow-hidden" />;
}
