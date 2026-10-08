"""Tenant-configured SMTP: validate all resolved IPs and pin the connection.

Platform SMTP settings remain operator-managed. Custom channel SMTP must not
reach private networks; TLS still verifies the original DNS hostname.
"""
import smtplib
import socket

from django.core.mail.backends.smtp import EmailBackend as DjangoEmailBackend

from common.security import resolve_safe_target_endpoint


class PublicSMTP(smtplib.SMTP):
    def _get_socket(self, host, port, timeout):
        if timeout == 0:
            raise ValueError('Non-blocking SMTP is not supported.')
        # Bracket IPv6 literals without allowing userinfo, paths or alternate ports.
        if not host or any(char in host for char in '/@?#'):
            raise ValueError('Servidor SMTP inválido.')
        endpoint_host = f'[{host}]' if ':' in host and not host.startswith('[') else host
        _, _, _, ips = resolve_safe_target_endpoint(f'http://{endpoint_host}:{port}', allow_private=False)
        return socket.create_connection((ips[0], port), timeout, self.source_address)


class PublicSMTPSSL(smtplib.SMTP_SSL):
    def _get_socket(self, host, port, timeout):
        raw = PublicSMTP._get_socket(self, host, port, timeout)
        try:
            return self.context.wrap_socket(raw, server_hostname=self._host)
        except Exception:
            raw.close()
            raise


class EmailBackend(DjangoEmailBackend):
    def open(self):
        if not self.use_tls and not self.use_ssl:
            raise ValueError('SMTP configurable requiere TLS o SSL.')
        return super().open()

    @property
    def connection_class(self):
        return PublicSMTPSSL if self.use_ssl else PublicSMTP
