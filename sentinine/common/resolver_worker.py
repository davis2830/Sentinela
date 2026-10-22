"""One disposable system-resolver call; stdin/stdout contain no control token."""
import json
import socket
import sys


def main():
    data = json.loads(sys.stdin.read(4096))
    try:
        records = socket.getaddrinfo(data['host'], data['port'], socket.AF_UNSPEC,
                                     socket.SOCK_STREAM, socket.IPPROTO_TCP)
        result, seen = [], set()
        for family, kind, proto, _, address in records:
            key = (family, tuple(address))
            if family in (socket.AF_INET, socket.AF_INET6) and key not in seen:
                seen.add(key)
                result.append([family, kind, proto, address])
            if len(result) == 32:
                break
        print(json.dumps({'addresses': result}))
    except socket.gaierror:
        print(json.dumps({'error': 'gaierror'}))


if __name__ == '__main__':
    main()
