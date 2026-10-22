"""Bounded, crash-recoverable task/result journal and independent delivery loops."""
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def interrupted(task):
    return {'target_id': task['target_id'], 'execution_id': task['execution_id'],
            'completed_at': utcnow(), 'status': 'error', 'response_time_ms': 0,
            'http_status': 0, 'error_message': 'Ejecución interrumpida; no se repite automáticamente.'}


class Journal:
    def __init__(self, path, limit=1000):
        self.path = str(path)
        self.limit = limit
        Path(path).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, payload TEXT NOT NULL, state TEXT NOT NULL, result TEXT)')
            db.execute('CREATE TABLE IF NOT EXISTS rejected (id TEXT PRIMARY KEY, result TEXT, reason TEXT, recorded_at TEXT)')
            db.execute('CREATE TABLE IF NOT EXISTS settled (id TEXT PRIMARY KEY, recorded_at REAL NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS health (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
        os.chmod(self.path, 0o600)
        # A running request may already have changed the endpoint. Never replay it.
        for task in self.tasks('running'):
            self.complete(task['execution_id'], interrupted(task))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        try:
            db.execute('PRAGMA synchronous=FULL')
            with db:
                yield db
        finally:
            db.close()

    def known(self):
        with self.connect() as db:
            return [row[0] for row in db.execute('SELECT id FROM jobs')]

    def capacity(self):
        with self.connect() as db:
            total = db.execute('SELECT count(*) FROM jobs').fetchone()[0]
            active = db.execute("SELECT count(*) FROM jobs WHERE state IN ('queued','running')").fetchone()[0]
        return max(0, min(10-active, self.limit-total))

    def enqueue(self, tasks):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            for task in tasks:
                if not task.get('execution_id') or not task.get('target_id'):
                    raise ValueError('El servidor no entregó una ejecución identificable.')
                if db.execute('SELECT 1 FROM jobs WHERE id=?', (task['execution_id'],)).fetchone():
                    continue
                if db.execute('SELECT 1 FROM settled WHERE id=?', (task['execution_id'],)).fetchone():
                    continue  # A stale heartbeat can arrive after its result acknowledgement.
                if db.execute('SELECT count(*) FROM jobs').fetchone()[0] >= self.limit:
                    raise RuntimeError('Cola local llena; no se descartan resultados pendientes.')
                db.execute('INSERT INTO jobs VALUES (?, ?, ?, NULL)',
                           (task['execution_id'], json.dumps(task), 'queued'))

    def tasks(self, state):
        with self.connect() as db:
            return [json.loads(r[0]) for r in db.execute('SELECT payload FROM jobs WHERE state=?', (state,))]

    def claim(self, execution_id):
        with self.connect() as db:
            return db.execute("UPDATE jobs SET state='running' WHERE id=? AND state='queued'", (execution_id,)).rowcount == 1

    def complete(self, execution_id, result):
        with self.connect() as db:
            db.execute("UPDATE jobs SET state='ready', payload='{}', result=? WHERE id=?",
                       (json.dumps(result), execution_id))

    def results(self):
        with self.connect() as db:
            return [json.loads(row[0]) for row in db.execute("SELECT result FROM jobs WHERE state='ready' LIMIT 100")]

    def acknowledge(self, acknowledgements, sent_ids):
        confirmed = rejected = 0
        with self.connect() as db:
            for ack in acknowledgements:
                identifier = ack.get('execution_id')
                if identifier not in sent_ids:
                    continue
                row = db.execute("SELECT result FROM jobs WHERE id=? AND state='ready'", (identifier,)).fetchone()
                if not row:
                    continue
                if ack.get('status') == 'rejected':
                    rejected += 1
                    db.execute('INSERT OR REPLACE INTO rejected VALUES (?, ?, ?, ?)',
                               (identifier, row[0], ack.get('reason', 'unknown'), utcnow()))
                elif ack.get('status') not in ('accepted', 'duplicate'):
                    continue  # Missing/unknown acknowledgement never removes a pending result.
                else:
                    confirmed += 1
                db.execute('DELETE FROM jobs WHERE id=?', (identifier,))
                db.execute('INSERT OR REPLACE INTO settled VALUES (?, ?)',
                           (identifier, datetime.now(timezone.utc).timestamp()))
            db.execute('DELETE FROM rejected WHERE id NOT IN (SELECT id FROM rejected ORDER BY recorded_at DESC LIMIT 1000)')
            db.execute('DELETE FROM settled WHERE recorded_at < ?', (datetime.now(timezone.utc).timestamp()-48*3600,))
            for key, count in (('last_ack_at', confirmed), ('last_rejection_at', rejected)):
                if count:
                    db.execute('INSERT OR REPLACE INTO health VALUES (?, ?)', (key, utcnow()))
        return {'confirmed': confirmed, 'rejected': rejected}

    def snapshot(self):
        # Same journal/scope as this runtime, without startup recovery or task contents.
        with self.connect() as db:
            counts = dict.fromkeys(('queued', 'running', 'ready'), 0)
            counts.update(dict(db.execute('SELECT state,count(*) FROM jobs GROUP BY state')))
            rejected = db.execute('SELECT count(*) FROM rejected').fetchone()[0]
            health = dict(db.execute('SELECT key,value FROM health'))
        return {'queue': counts, 'queue_limit': self.limit, 'rejected_retained': rejected,
                'last_ack_at': health.get('last_ack_at'),
                'last_rejection_at': health.get('last_rejection_at')}


class DeliveryRuntime:
    def __init__(self, journal, check, heartbeat, submit, log, workers=10, draining=lambda: False):
        self.journal, self.check, self.heartbeat, self.submit, self.log = journal, check, heartbeat, submit, log
        self.workers = workers
        self.draining = draining
        self.stop = threading.Event()
        self.threads = []
        self.health_lock = threading.Lock()
        self.errors = {}

    def set_error(self, component, code=None):
        with self.health_lock:
            if code:
                previous = self.errors.get(component, {})
                self.errors[component] = {'component': component, 'code': code,
                    'failures': min(1000000, previous.get('failures', 0)+1)}
            else:
                self.errors.pop(component, None)

    def telemetry(self):
        try:
            snapshot = self.journal.snapshot()
        except (OSError, sqlite3.Error):
            self.set_error('storage', 'local_storage')
            snapshot = {'queue': None, 'queue_limit': self.journal.limit,
                        'rejected_retained': None, 'last_ack_at': None, 'last_rejection_at': None}
        with self.health_lock:
            errors = [dict(value) for value in self.errors.values()]
        return {**snapshot, 'schema_version': 1, 'draining': bool(self.draining()),
                'errors': errors}

    def recover_storage(self):
        with self.health_lock:
            failed = 'storage' in self.errors
        if failed:
            # A successful SELECT does not prove a full/read-only disk can save results.
            with self.journal.connect() as db:
                db.execute('INSERT OR REPLACE INTO health VALUES (?, ?)', ('storage_check_at', utcnow()))
            self.set_error('storage')

    def execute(self, task):
        identifier = task['execution_id']
        if not self.journal.claim(identifier):
            return
        try:
            deadline = datetime.fromisoformat(task['run_before'])
            if deadline <= datetime.now(timezone.utc):
                result = interrupted(task)
                result['error_message'] = 'Ventana de ejecución vencida; no se ejecutó la petición.'
            else:
                result = self.check(task)
                result.update(execution_id=identifier, completed_at=utcnow())
        except Exception:
            result = interrupted(task)
        # A disk error propagates and leaves the job running; startup reports interruption.
        self.journal.complete(identifier, result)

    def schedule_loop(self):
        executor = ThreadPoolExecutor(max_workers=self.workers)
        futures = {}
        try:
            while not self.stop.is_set():
                try:
                    for identifier, (future, _) in list(futures.items()):
                        if future.done():
                            try:
                                future.result()
                            finally:
                                del futures[identifier]
                    for task in self.journal.tasks('queued'):
                        if len(futures) >= self.workers:
                            break
                        if (task['execution_id'] not in futures and
                            task['target_id'] not in {target for _, target in futures.values()}):
                            futures[task['execution_id']] = (executor.submit(self.execute, task), task['target_id'])
                    self.recover_storage()
                except Exception:
                    self.set_error('storage', 'local_storage')
                    self.log('[ERROR] No se pudo procesar el diario local; revisar disco y permisos.')
                self.stop.wait(.2)
        finally:
            executor.shutdown(wait=True)

    def heartbeat_loop(self):
        failures = 0
        while not self.stop.is_set():
            interval = 10
            try:
                try:
                    capacity, known = self.journal.capacity(), self.journal.known()
                except (OSError, sqlite3.Error):
                    self.set_error('storage', 'local_storage')
                    capacity, known = 0, []
                snapshot = self.telemetry()
                data = self.heartbeat(capacity=0 if snapshot['draining'] or snapshot['queue'] is None or
                                      any(e['component'] == 'storage' for e in snapshot['errors']) else capacity,
                                      known_executions=known, telemetry=snapshot)
                self.set_error('heartbeat')
                if data.get('delivery_protocol') != 2:
                    raise ValueError('Actualizar backend: se requiere protocolo de entrega v2.')
                try:
                    self.journal.enqueue(data.get('tasks', []))
                except (OSError, sqlite3.Error, RuntimeError):
                    self.set_error('storage', 'local_storage')
                    raise
                interval = max(1, min(30, float(data.get('poll_interval_seconds', 10))))
                failures = 0
            except Exception:
                self.set_error('heartbeat', 'control_unconfirmed')
                failures += 1
                interval = min(30, 5*failures)
                self.log('[ADVERTENCIA] Heartbeat no confirmado; se reintentará sin detener chequeos/entrega.')
            self.stop.wait(interval)

    def deliver_once(self):
        try:
            self._deliver_once()
        except (OSError, sqlite3.Error) as exc:
            self.set_error('storage' if isinstance(exc, sqlite3.Error) else 'delivery',
                           'local_storage' if isinstance(exc, sqlite3.Error) else 'delivery_unconfirmed')
            raise
        except Exception:
            self.set_error('delivery', 'receipt_incomplete')
            raise

    def _deliver_once(self):
        results = self.journal.results()
        if results:
            data = self.submit(results)
            acknowledgements = data.get('acknowledgements')
            if not isinstance(acknowledgements, list):
                raise ValueError('Acuse individual ausente; resultados conservados.')
            sent_ids = {r['execution_id'] for r in results}
            outcome = self.journal.acknowledge(acknowledgements, sent_ids)
            rejected = outcome['rejected']
            if rejected:
                self.log(f'[ADVERTENCIA] {rejected} resultado(s) rechazados; detalle conservado en diario local.')
            if outcome['confirmed'] + rejected < len(sent_ids):
                raise ValueError('Acuse individual incompleto; resultados conservados.')
            self.set_error('delivery')

    def sender_loop(self):
        failures = 0
        while not self.stop.is_set():
            try:
                self.deliver_once()
                failures = 0
            except Exception:
                failures += 1
                self.log('[ADVERTENCIA] Entrega no confirmada; resultados conservados para reintento.')
            self.stop.wait(min(30, max(2, 5*failures)))

    def start(self):
        for loop in (self.schedule_loop, self.sender_loop, self.heartbeat_loop):
            thread = threading.Thread(target=loop, daemon=True)
            thread.start()
            self.threads.append(thread)

    def close(self):
        self.stop.set()
        for thread in self.threads:
            thread.join()


def local_status(directory):
    # Read-only inspection must never run Journal's startup recovery on a live agent.
    counts = {'queued':0,'running':0,'ready':0,'rejected':0}
    for path in Path(directory).glob('*.sqlite3'):
        db=sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True)
        try:
            for state, count in db.execute('SELECT state,count(*) FROM jobs GROUP BY state'):
                if state in counts:counts[state]+=count
            counts['rejected']+=db.execute('SELECT count(*) FROM rejected').fetchone()[0]
        finally:db.close()
    return {**counts,'pending':counts['queued']+counts['running']+counts['ready'],
            'draining':(Path(directory)/'drain').exists()}


if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser(description='Senti9: control local sin revelar tareas ni secretos')
    parser.add_argument('command',choices=['status','drain','resume'],default='status',nargs='?')
    command=parser.parse_args().command
    directory=Path(os.environ.get('SENTININE_STATE_DIR',str(Path.home()/'.local'/'state'/'senti9')))
    if command=='drain':
        directory.mkdir(parents=True,exist_ok=True,mode=0o700)
        (directory/'drain').touch(mode=0o600)
    elif command=='resume':
        (directory/'drain').unlink(missing_ok=True)
    print(json.dumps(local_status(directory)))
