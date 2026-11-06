import test from 'node:test';
import assert from 'node:assert/strict';
import { dhakaInputToIso, dhakaInputValue, isOpenRequest, pickupRange, requestErrorKey, sortRequests } from './ambulanceRequests.js';

test('pickup times are read and shown in Dhaka time', () => {
  assert.equal(dhakaInputToIso('2026-11-06T18:30'), '2026-11-06T12:30:00.000Z');
  assert.equal(dhakaInputValue(new Date('2026-11-06T20:15:00Z')), '2026-11-07T02:15');
  assert.equal(dhakaInputToIso(''), null);
  assert.equal(dhakaInputToIso('tomorrow'), null);
  assert.equal(dhakaInputToIso(undefined), null);
});

test('the form offers pickups from now to seven days ahead', () => {
  const range = pickupRange(new Date('2026-11-06T00:00:00Z'));
  assert.deepEqual(range, { min: '2026-11-06T06:00', max: '2026-11-13T06:00' });
});

test('open requests come first', () => {
  const requests = [
    { id: 'a', status: 'completed' },
    { id: 'b', status: 'new' },
    { id: 'c', status: 'cancelled' },
    { id: 'd', status: 'accepted' },
  ];
  assert.deepEqual(sortRequests(requests).map(r => r.id), ['b', 'd', 'a', 'c']);
  assert.equal(isOpenRequest({ status: 'declined' }), false);
});

test('API error codes map to messages', () => {
  assert.equal(requestErrorKey({ code: 'TOO_MANY_REQUESTS' }), 'ar_err_too_many');
  assert.equal(requestErrorKey({ code: 'REQUEST_STATUS' }), 'ar_err_status');
  assert.equal(requestErrorKey({ code: 'SOMETHING_ELSE' }), 'ar_err_generic');
  assert.equal(requestErrorKey(null), 'ar_err_generic');
});
