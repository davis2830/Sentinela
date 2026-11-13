"""Install from the same non-secret versioned profile downloaded from Sentinel."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path
from security import validate_server_url


def arguments(profile,token_file):
    if profile.get('schema_version')!=1 or profile.get('version')!='1.8.0' or not profile.get('configured'):
        raise ValueError('Perfil no válido o incompatible. Descarga el perfil 1.8.0 desde Sentinel.')
    for key in ['container_name','volume_name']:
        if not re.fullmatch(r'senti9-[a-z0-9-]{8,64}',str(profile.get(key,''))):raise ValueError('Identidad del perfil no válida.')
    image=profile.get('image','')
    if not re.fullmatch(r'[a-zA-Z0-9._/:@-]+',image) or ':latest' in image:raise ValueError('Imagen del perfil no válida.')
    server=validate_server_url(profile['server_url'])
    token=Path(token_file).resolve(strict=True)
    if not token.is_file():raise ValueError('Selecciona el archivo privado de token.')
    # Docker argv is constructed without shell/eval; paths containing spaces stay one argument.
    args=['run','-d','--name',profile['container_name'],'--restart','unless-stopped','--pull','never' if profile.get('distribution')=='local' else 'always','--user','10001:10001','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--pids-limit','128','--memory','256m','--cpus','1','--tmpfs','/tmp:rw,noexec,nosuid,size=16m,mode=1777','--mount',f"source={profile['volume_name']},target=/data",'--mount',f'type=bind,source={token},target=/run/secrets/sentinine_token,readonly','-e','SENTININE_TOKEN_FILE=/run/secrets/sentinine_token','-e',f'SENTININE_SERVER={server}']
    if os.environ.get('SENTININE_ENV')=='development':
        args+=['-e','SENTININE_ENV=development','-e','SENTININE_ALLOW_HTTP='+os.environ.get('SENTININE_ALLOW_HTTP','false')]
        if profile.get('platform')=='linux':args+=['--add-host','host.docker.internal:host-gateway']
    for variable in ['SENTININE_CONTROL_CA_FILE','SENTININE_TARGET_CA_FILE']:
        if os.environ.get(variable):
            source=Path(os.environ[variable]).resolve(strict=True)
            destination=f'/run/certs/{variable}.pem'
            args+=['--mount',f'type=bind,source={source},target={destination},readonly','-e',f'{variable}={destination}']
    return args+[image]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile',required=True,type=Path)
    parser.add_argument('--token-file',required=True,type=Path)
    options=parser.parse_args()
    profile=json.loads(options.profile.read_text(encoding='utf-8-sig'))
    args=arguments(profile,options.token_file)
    if subprocess.check_output(['docker','info','--format','{{.OSType}}'],text=True).strip()!='linux':raise ValueError('Usa Docker Engine Linux o Docker Desktop con contenedores Linux.')
    if subprocess.run(['docker','container','inspect',profile['container_name']],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:raise ValueError('El contenedor ya existe. Sigue la actualización conservando su volumen.')
    subprocess.run(['docker',*args],check=True)
    print('Contenedor creado. Comprueba primera señal y diagnóstico; el inicio no confirma mediciones.')


if __name__=='__main__':main()
