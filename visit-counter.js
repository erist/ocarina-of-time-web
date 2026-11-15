import { startVisitTracking } from './visits.js';

const database = 'projects/erist-ocarina-visits/databases/(default)/documents';
const fields = {
  view: 'pageViews', visit: 'visits', visitor: 'visitors',
  instagramView: 'instagramViews', instagramVisit: 'instagramVisits', instagramVisitor: 'instagramVisitors',
};

// One atomic write per load. Google Cloud IAM provides the owner's totals view.
async function sendCounters(event) {
  const fieldTransforms = Object.entries(fields)
    .filter(([flag]) => event[flag])
    .map(([, fieldPath]) => ({ fieldPath, increment: { integerValue: '1' } }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`https://firestore.googleapis.com/v1/${database}:commit?fields=commitTime`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
      referrerPolicy: 'no-referrer', keepalive: true, signal: controller.signal,
      body: JSON.stringify({ writes: [{ transform: { document: `${database}/sites/ocarina`, fieldTransforms } }] }),
    });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}

void startVisitTracking(sendCounters);
