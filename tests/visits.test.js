import test from 'node:test';
import assert from 'node:assert/strict';
import { startVisitTracking } from '../app/visits.js';

const site = 'https://erist.github.io/ocarina-of-time-web/';
function storage() {
  const items = new Map();
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: key => items.delete(key),
  };
}

function page({ href = site, referrer = '', local = storage(), session = storage(), navigator = {} } = {}) {
  return { location: { href }, document: { referrer }, navigator, localStorage: local, sessionStorage: session };
}
async function count(tab) {
  let event;
  await startVisitTracking(value => { event = value; }, tab);
  return event;
}

test('a tagged Instagram visit, reload and later return separate views, sessions and visitors', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000_000 });
  const local = storage();
  const first = page({ href: site + '?utm_source=instagram&private=ignored', local });
  const event = await count(first);
  assert.deepEqual(event, { view: true, visit: true, visitor: true, instagramVisit: true, instagramVisitor: true, instagramView: true });
  assert.equal(await count(first), undefined, 'the same document only emits once');
  const reload = await count(page({ local, referrer: site }));
  assert.deepEqual(reload, { view: true, visit: false, visitor: false, instagramVisit: false, instagramVisitor: false, instagramView: true });
  t.mock.timers.tick(30 * 60 * 1000);
  const later = await count(page({ local }));
  assert.deepEqual(later, { view: true, visit: true, visitor: false, instagramVisit: false, instagramVisitor: false, instagramView: false });
});

test('Instagram links and their real referrer count once per browser and once per entry session', async () => {
  const local = storage();
  assert.equal((await count(page({ local }))).instagramView, false);
  const ig = await count(page({ referrer: 'https://l.instagram.com/?u=private', local }));
  assert.ok(ig.visit && ig.instagramVisit && ig.instagramVisitor);
  assert.equal(ig.visitor, false);
  const same = await count(page({ href: site + '?utm_source=IG', local }));
  assert.ok(same.instagramView && !same.instagramVisit && !same.instagramVisitor);
  const other = await count(page({ referrer: 'https://instagram.com.unrelated.example/', local }));
  assert.ok(other.visit && !other.instagramView);
  assert.equal((await count(page({ href: site + '?utm_source=email', referrer: 'https://instagram.com' }))).instagramView, false);
});

test('unavailable storage omits unique estimates and blocked tabs can still report loads', async () => {
  const blocked = { setItem() { throw new Error('blocked'); } };
  const session = storage();
  const first = await count(page({ local: blocked, session, href: site + '?utm_source=instagram' }));
  assert.ok(first.visit && first.instagramVisit && !first.visitor && !first.instagramVisitor);
  const next = await count(page({ local: blocked, session }));
  assert.ok(next.instagramView && !next.visit);
  const unknown = await count(page({ local: blocked, session: blocked, referrer: 'https://www.instagram.com/' }));
  assert.deepEqual(unknown, { view: true, instagramView: true, visit: false, instagramVisit: false, visitor: false, instagramVisitor: false });
});

test('unconfirmed delivery leaves new-visitor markers available on the next load', async () => {
  const local = storage();
  for (const send of [() => false, () => Promise.reject(new Error('offline'))]) {
    assert.equal(await startVisitTracking(send, page({ local })), false);
  }
  assert.equal((await count(page({ local }))).visitor, true);
});

test('two tabs sharing Web Locks and storage submit one new-visitor event', async () => {
  let queue = Promise.resolve();
  const locks = { request(key, work) { return queue = queue.then(work); } };
  const setup = { local: storage(), navigator: { locks }, href: site + '?utm_source=instagram' };
  const [first, second] = await Promise.all([count(page(setup)), count(page(setup))]);
  assert.equal(first.visitor, true);
  assert.equal(second.visitor, false);
  assert.equal(second.visit, false);
  assert.equal(second.instagramVisitor, false);
});

test('the public instrument entry is the only tracked page and privacy signals opt out', async () => {
  for (const href of ['http://localhost:4173/', 'https://example.com/', site + 'stats/', 'https://erist.github.io/another-project/']) {
    assert.equal(await count(page({ href })), undefined);
  }
  for (const navigator of [{ globalPrivacyControl: true }, { doNotTrack: '1' }]) {
    assert.equal(await count(page({ navigator })), undefined);
  }
  assert.equal((await count(page({ href: site + 'index.html' }))).view, true);
});
