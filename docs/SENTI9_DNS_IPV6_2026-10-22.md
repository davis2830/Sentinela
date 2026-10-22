# Senti9 1.6.0: DNS acotado e IPv6

## Implementación

- Resolución del sistema con AF_UNSPEC: A y AAAA, IPv4/IPv6 numéricos sin DNS.
- Proceso Python aislado por resolución, timeout y kill/wait al agotarse. Entorno
  del hijo sin token, ruta de secreto ni PYTHONPATH; destino por stdin, no shell.
- DNS timeout configurable (5 s por defecto); conexión comparte un deadline entre
  resolución y fallback, repartiendo tiempo entre candidatos.
- TCP acepta hostname, IPv4, IPv6 y [IPv6]:puerto. Puertos inválidos no se cambian
  silenciosamente a 80. Se cierran sockets fallidos y exitosos.
- HTTP/HTTPS de targets y canal de control usan la resolución acotada, conectan a
  IPs candidatas sin una segunda búsqueda y conservan Host/SNI/certificado.
- Validación de IPs antes de conectar targets: no loopback, link-local,
  multicast, unspecified, metadata conocida ni bypass por IPv4-mapped IPv6.
  RFC1918 y ULA ordinarias continúan disponibles en agentes privados.
- Backend acepta nombres LAN sin intentar resolverlos en Cloud; exige agente
  propio asignado. Cloud conserva resolución y controles SSRF; cambiar de runner
  revalida el destino guardado. IPv6 sin corchetes se normaliza para almacenar.
- El formulario TCP conserva dirección y puerto IPv6 al editar y serializa con
  corchetes. La selección automática de ejecución privada reconoce ULA.

La dirección IPv6 de metadata AWS se excluye explícitamente además de las redes
protegidas; su uso está documentado por
[AWS EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html).

## Semántica DNS

DNS significa resolución del nombre desde el SO/contenedor del agente, incluidos
su resolver, hosts, caché y dominios de búsqueda. Un resultado AAAA sin A es válido.
No significa prueba de un servidor DNS elegido ni validación MX/TXT/NS, DNSSEC o
valor esperado. No se añadieron esos controles ni selectores.

IP literal no hace una consulta: ahora genera error de configuración. Un puerto
en hostname:53 tampoco selecciona nameserver y se rechaza. Estos casos también se
validan al crear/editar; configuraciones antiguas no se modificaron masivamente.
Para medir servicio DNS de un servidor concreto hace falta un chequeo de protocolo
adicional; un TCP :53 solo mide apertura de conexión.

## Evidencia local

- 49 pruebas del agente: timeout de un proceso bloqueado realmente terminado y
  recogido, ausencia de secretos en su entorno, A/AAAA, AAAA-only, IPv6 numérico,
  fallback, presupuesto compartido, cierre de sockets, límites de red y regresión
  de TLS/entrega. IPv4 y IPv6 TCP probados realmente en loopback del contenedor.
- 8 pruebas backend nuevas: sintaxis, nombres LAN, límites Cloud/tenant, edición,
  transición de runner, normalización IPv6 y semántica DNS.
- 3 pruebas Node del formulario: round trip de IPv4/IPv6/hostname, IPv6 sin puerto
  y cambio de HTTPS a TCP conservando su puerto de servicio.
- Suite Django completa: 282/282, 109,783 s. Build frontend aprobado, 26,12 s.
- Guard final de metadata IPv6 verificado repitiendo los 3 contratos de sintaxis;
  suite final del agente 49/49 en 4,721 s. Imagen runtime 1.6.0 construida.
  No se publicó imagen ni hubo tráfico hacia LAN
  corporativa o dominio real; solo fixtures y loopback con --network none.

## Alcance pendiente

La resolución lleva overhead del proceso y la latencia medida lo incluye. El
timeout no constituye garantía de scheduling de tiempo real ni deadline absoluto
de toda lectura HTTP. El control conserva su timeout de conexión y validación TLS.
IPv6 LAN requiere rutas/soporte de Docker/host; falta piloto en red representativa
y validación nativa Windows. No se afirma CI remoto ni producción lista.

Imagen local: sentinel/sentinine:1.6.0. Publicación/firma de releases,
actualización/rollback ensayados, estado de cola en UI y piloto son próximos bloques.
