"""Read-only local/control diagnostics. Never imports agent or initializes Journal."""
import json
import os
import sqlite3
from pathlib import Path
from urllib.request import Request
from security import validate_server_url, load_token, tls_context, control_request


def diagnose():
    checks={}
    token=None
    server=None
    try:
        server=validate_server_url(os.environ.get('SENTININE_SERVER',''))
        checks['configuration']='ok'
    except (ValueError,OSError):checks['configuration']='invalid'
    try:token=load_token();checks['token']='readable'
    except (ValueError,OSError):checks['token']='unreadable'
    try:tls_context(control=True);tls_context();checks['ca']='ok'
    except (ValueError,OSError):checks['ca']='invalid'
    directory=Path(os.environ.get('SENTININE_STATE_DIR','/data'))
    if not list(directory.glob('*.sqlite3')):checks['local_state']='not_initialized'
    else:
        try:
            from delivery import local_status
            checks['local_state']=local_status(directory)
        except (OSError,sqlite3.Error):checks['local_state']='unavailable'
    checks['control']='not_checked'
    if server and token and checks['ca']=='ok':
        try:
            request=Request(server+'/api/v1/agent-probes/diagnostic/',headers={'X-Probe-Token':token,'Accept':'application/json'})
            with control_request(request,timeout=10) as response:
                data=json.loads(response.read(4096))
                checks['control']='authenticated' if data.get('data',{}).get('authenticated') is True else 'unconfirmed'
        except Exception:
            # Exception strings can contain URLs, headers or local private paths.
            checks['control']='unavailable_or_unauthorized'
    return checks


if __name__=='__main__':
    report=diagnose()
    print(json.dumps(report,ensure_ascii=False))
    raise SystemExit(0 if report['control']=='authenticated' else 1)
