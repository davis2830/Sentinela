"""Executed only in network-disabled containers with a disposable test volume."""
import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from delivery import Journal

ROOT = Path('/data')
TOKEN = 'synthetic-release-test-not-a-real-token'
SERVER = 'https://sentinel.fixture.invalid'
SCOPE = hashlib.sha256((SERVER+'\0'+TOKEN).encode()).hexdigest()[:24]
IDS = [f'00000000-0000-4000-8000-{n:012d}' for n in range(1, 5)]


def task(index):
    return {'execution_id': IDS[index], 'target_id': f'target-{index}',
            'run_before': (datetime.now(timezone.utc)+timedelta(minutes=10)).isoformat(),
            'custom_headers': {'Authorization': 'synthetic-header'}}


def result(index):
    return {'execution_id': IDS[index], 'target_id': f'target-{index}', 'status': 'up',
            'response_time_ms': 42, 'completed_at': datetime.now(timezone.utc).isoformat()}


phase = sys.argv[1]
if phase == 'seed':
    (ROOT/'token.fixture').write_text(TOKEN)
    (ROOT/'config.fixture').write_text(SERVER)
    (ROOT/'drain').touch()

assert (ROOT/'token.fixture').read_text() == TOKEN
assert (ROOT/'config.fixture').read_text() == SERVER
assert (ROOT/'drain').exists()
journal = Journal(ROOT/f'{SCOPE}.sqlite3')

if phase == 'seed':
    journal.enqueue([task(0), task(1), task(2)])
    journal.claim(IDS[1]); journal.complete(IDS[1], result(1))
    journal.claim(IDS[2])  # Represents a forced stop during a request, never replayed.
    assert len(journal.tasks('queued')) == 1
    assert len(journal.tasks('running')) == 1
    assert len(journal.results()) == 1
elif phase == 'upgrade':
    assert journal.snapshot()['queue'] == {'queued': 1, 'running': 0, 'ready': 2}
    interrupted = next(r for r in journal.results() if r['execution_id'] == IDS[2])
    assert interrupted['status'] == 'error'
    assert (ROOT/f'{SCOPE}.sqlite3').exists()
    journal.acknowledge([{'execution_id': IDS[1], 'status': 'accepted'}], {IDS[1]})
    last_ack = journal.snapshot()['last_ack_at']
    assert last_ack
    (ROOT/'ack.fixture').write_text(last_ack)
    journal.enqueue([task(3)])
    journal.claim(IDS[3]); journal.complete(IDS[3], result(3))
elif phase == 'rollback':
    assert set(journal.known()) == {IDS[0], IDS[2], IDS[3]}
    assert not journal.tasks('running')
    journal.acknowledge([{'execution_id': IDS[2], 'status': 'duplicate'}], {IDS[2]})
    with journal.connect() as db:
        assert db.execute("SELECT value FROM health WHERE key='last_ack_at'").fetchone()[0] == (ROOT/'ack.fixture').read_text()
elif phase == 'resume':
    assert journal.snapshot()['last_ack_at'] == (ROOT/'ack.fixture').read_text()
    assert set(journal.known()) == {IDS[0], IDS[3]}
    assert journal.snapshot()['queue'] == {'queued': 1, 'running': 0, 'ready': 1}
    journal.enqueue([task(1), task(2)])  # Settled IDs must not execute a second time.
    assert set(journal.known()) == {IDS[0], IDS[3]}
    journal.claim(IDS[0]); journal.complete(IDS[0], result(0))
    journal.acknowledge([{'execution_id': identifier, 'status': 'accepted'} for identifier in (IDS[0], IDS[3])], {IDS[0], IDS[3]})
    assert not journal.known()
    assert journal.snapshot()['queue'] == {'queued': 0, 'running': 0, 'ready': 0}
else:
    raise ValueError('Unknown test phase')

print(json.dumps({'phase': phase, 'passed': True, 'token_and_configuration_preserved': True,
                  'journal_scope_preserved': True, 'drain_preserved': True}))
