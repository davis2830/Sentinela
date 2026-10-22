"""Local release candidate tooling. Never pushes images or starts the real agent."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = '1.7.0'
BASELINE_VERSION = '1.6.0'
IMAGE = f'davis1924/senti9:{VERSION}'


def run(*args, **kwargs):
    return subprocess.run(list(args), check=True, capture_output=True, text=True, **kwargs).stdout.strip()


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def inspect(image):
    data = json.loads(run('docker', 'image', 'inspect', image))[0]
    return {'reference': image, 'image_id': data['Id'], 'os': data['Os'], 'architecture': data['Architecture']}


def check_version(image, expected):
    code = "import ast,pathlib; t=ast.parse(pathlib.Path('/app/agent.py').read_text()); print(next(ast.literal_eval(n.value) for n in t.body if isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='AGENT_VERSION' for x in n.targets)))"
    actual = run('docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--read-only',
                 '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
                 '--pids-limit', '128', '--memory', '256m', image, 'python', '-c', code)
    if actual != expected:
        raise ValueError(f'Versión inesperada: {actual}; se requiere {expected}.')


def compatibility(baseline, candidate, output):
    output = Path(output)
    if output.exists():
        raise FileExistsError(output)
    old, new = inspect(baseline), inspect(candidate)
    if (old['os'], old['architecture']) != (new['os'], new['architecture']):
        raise ValueError('Las arquitecturas deben coincidir.')
    check_version(old['image_id'], BASELINE_VERSION)
    check_version(new['image_id'], VERSION)
    volume = 'senti9-release-test-' + uuid.uuid4().hex
    label = 'com.gctechops.senti9.release-test'
    run('docker', 'volume', 'create', '--label', label+'=true', volume)
    phases = []
    try:
        script = (ROOT/'release'/'compatibility.py').read_text(encoding='utf-8')
        for phase, image in [('seed', old), ('upgrade', new), ('rollback', old), ('resume', new)]:
            result = run('docker', 'run', '--rm', '-i', '--pull', 'never', '--network', 'none', '--read-only',
                '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--pids-limit', '128',
                '--memory', '256m', '--label', label+'=true',
                '--mount', f'type=volume,source={volume},target=/data',
                image['image_id'], 'python', '-', phase, input=script)
            phases.append(json.loads(result))
    finally:
        labels = json.loads(run('docker', 'volume', 'inspect', volume))[0].get('Labels') or {}
        if labels.get(label) != 'true' or not volume.startswith('senti9-release-test-'):
            raise RuntimeError('No se retirará un volumen ajeno a esta prueba.')
        run('docker', 'volume', 'rm', volume)
    report = {'schema_version': 1, 'passed': True, 'baseline': old, 'candidate': new,
              'network': 'none', 'scope': 'journal_compatibility_with_synthetic_data', 'phases': phases}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    return report


def write_checksums(directory):
    directory = Path(directory)
    lines = [f'{sha256(path)}  {path.name}\n' for path in sorted(directory.iterdir()) if path.is_file() and path.name != 'SHA256SUMS']
    (directory/'SHA256SUMS').write_text(''.join(lines), encoding='utf-8')


def verify(directory, public_key=None):
    directory = Path(directory).resolve()
    entries = (directory/'SHA256SUMS').read_text(encoding='utf-8').splitlines()
    expected = set()
    for line in entries:
        match = re.fullmatch(r'([0-9a-f]{64})  ([A-Za-z0-9_.-]+)', line)
        if not match or match[2] in expected or match[2] in ('.', '..', 'SHA256SUMS'):
            raise ValueError('Listado de integridad no válido.')
        digest, name = match.groups()
        path = directory/name
        if path.is_symlink() or not path.is_file() or sha256(path) != digest:
            raise ValueError(f'Integridad no válida: {name}')
        expected.add(name)
    if not expected or not {'release.json', 'compatibility.json'} <= expected:
        raise ValueError('Paquete incompleto.')
    actual = {path.name for path in directory.iterdir()}
    if actual - expected - {'SHA256SUMS', 'SHA256SUMS.sigstore.json'}:
        raise ValueError('El paquete contiene archivos no inventariados.')
    if public_key:
        run('cosign', 'verify-blob', '--key', str(Path(public_key).resolve()), '--bundle',
            str(directory/'SHA256SUMS.sigstore.json'), str(directory/'SHA256SUMS'))
    return {'integrity': 'verified', 'authenticity': 'verified_with_supplied_key' if public_key else 'not_verified'}


def prepare(image, baseline, report_path, output):
    directory = Path(output).resolve()
    if directory.exists():
        raise FileExistsError('El destino debe ser nuevo; no se sobrescriben candidatos.')
    new, old = inspect(image), inspect(baseline)
    report = json.loads(Path(report_path).read_text(encoding='utf-8'))
    if (report.get('passed') is not True or report.get('candidate') != new or report.get('baseline') != old or
        [phase.get('phase') for phase in report.get('phases', [])] != ['seed', 'upgrade', 'rollback', 'resume'] or
        not all(phase.get('passed') is True for phase in report.get('phases', []))):
        raise ValueError('Falta evidencia de compatibilidad para estas imágenes exactas.')
    if image != IMAGE:
        raise ValueError(f'El destino aprobado de esta versión es {IMAGE}.')
    check_version(new['image_id'], VERSION)
    directory.mkdir(parents=True)
    runtime = [ROOT/'agent.py', ROOT/'delivery.py', ROOT/'security.py', ROOT/'Dockerfile', *sorted((ROOT/'common').glob('*.py'))]
    source_hashes = {str(path.relative_to(ROOT)).replace('\\', '/'): sha256(path) for path in runtime}
    code_paths = [name for name in source_hashes if name != 'Dockerfile']
    image_hashes = json.loads(run('docker', 'run', '--rm', '-i', '--pull', 'never', '--network', 'none',
        '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
        new['image_id'], 'python', '-c',
        "import hashlib,json,pathlib,sys; print(json.dumps({p:hashlib.sha256((pathlib.Path('/app')/p).read_bytes()).hexdigest() for p in json.load(sys.stdin)}))",
        input=json.dumps(code_paths)))
    if image_hashes != {name: source_hashes[name] for name in code_paths}:
        raise ValueError('La imagen no corresponde a los fuentes actuales; reconstruir candidato.')
    manifest = {'schema_version': 1, 'version': VERSION, 'status': 'local_candidate_not_published',
        'built_at': datetime.now(timezone.utc).isoformat(), 'candidate': new, 'baseline': old,
        'runtime_source_sha256': source_hashes, 'required_backend_migration': 'monitoring.0008_agent_probe_telemetry',
        'signature': 'requires_external_trusted_key', 'ci': 'not_attested_by_this_command'}
    (directory/'release.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    shutil.copyfile(report_path, directory/'compatibility.json')
    for name in ('README.md', 'install.ps1', 'install.sh', 'docker-compose.yml'):
        shutil.copyfile(ROOT/name, directory/name)
    shutil.copyfile(ROOT/'release'/'RELEASE_NOTES.md', directory/'RELEASE_NOTES.md')
    shutil.copyfile(ROOT/'release'/'OPERATIONS.md', directory/'OPERATIONS.md')
    for version, metadata in ((VERSION, new), (BASELINE_VERSION, old)):
        archive = directory/f'senti9-{version}-{metadata["os"]}-{metadata["architecture"]}.docker.tar'
        run('docker', 'image', 'save', '--output', str(archive), metadata['reference'])
        if inspect(metadata['reference']) != metadata:
            raise RuntimeError('La referencia cambió durante la exportación; descartar este candidato.')
    write_checksums(directory)
    verify(directory)
    return {'package': str(directory), 'status': manifest['status'], 'signature': 'pending'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    compat = commands.add_parser('compatibility')
    compat.add_argument('--baseline', required=True)
    compat.add_argument('--candidate', default=IMAGE)
    compat.add_argument('--output', required=True)
    package = commands.add_parser('prepare')
    package.add_argument('--image', default=IMAGE)
    package.add_argument('--baseline', required=True)
    package.add_argument('--report', required=True)
    package.add_argument('--output', required=True)
    check = commands.add_parser('verify')
    check.add_argument('directory')
    check.add_argument('--public-key')
    args = parser.parse_args()
    if args.command == 'compatibility':
        result = compatibility(args.baseline, args.candidate, args.output)
    elif args.command == 'prepare':
        result = prepare(args.image, args.baseline, args.report, args.output)
    else:
        result = verify(args.directory, args.public_key)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
