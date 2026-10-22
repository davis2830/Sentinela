/** Keep IPv6 address colons distinct from the TCP port delimiter. */
export function tcpParts(value: string): {host:string; port:string} {
  const raw=value.trim();
  if (!raw) return {host:'',port:'80'};
  if (!raw.includes('://') && !raw.startsWith('[') && (raw.match(/:/g)?.length||0)>1) return {host:raw,port:'80'};
  try {
    const url=new URL(raw.includes('://')?raw:`http://${raw}`);
    return {host:url.hostname.replace(/^\[|\]$/g,''),port:url.port||(url.protocol==='https:'?'443':'80')};
  } catch { return {host:raw,port:'80'}; }
}

export function tcpEndpoint(host:string, port:string):string {
  const clean=host.trim().replace(/^\[|\]$/g,'');
  return `${clean.includes(':')?`[${clean}]`:clean}:${port.trim()}`;
}
