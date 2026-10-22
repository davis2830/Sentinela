"""LAN-capable HTTP transport. Never follow redirects or inherit proxy settings.

Unlike the cloud transport, private destinations are intentional for this agent.
"""
import urllib.parse
import urllib.request
import http.client
from .network import connect_bounded


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def open_request(request, *, timeout, context=None, target=False):
    parsed = urllib.parse.urlsplit(request.full_url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Se requiere URL HTTP(S) sin credenciales embebidas.')
    def connection(cls, host, **kwargs):
        instance = cls(host, **kwargs)
        instance._create_connection = lambda address, timeout, source_address=None: connect_bounded(
            address[0], address[1], timeout, target=target)
        return instance
    class HTTPHandler(urllib.request.HTTPHandler):
        def http_open(self, req):
            return self.do_open(lambda host, **kw: connection(http.client.HTTPConnection, host, **kw), req)
    class HTTPSHandler(urllib.request.HTTPSHandler):
        def https_open(self, req):
            return self.do_open(lambda host, **kw: connection(http.client.HTTPSConnection, host, **kw),
                                req, context=self._context, check_hostname=self._check_hostname)
    handlers = [urllib.request.ProxyHandler({}), NoRedirect(), HTTPHandler(), HTTPSHandler(context=context)]
    return urllib.request.build_opener(*handlers).open(request, timeout=timeout)
