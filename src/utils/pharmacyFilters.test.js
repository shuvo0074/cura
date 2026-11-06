import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPharmacies, filterStock, isOpenOrder, latestOrderByPrescription, orderErrorKey, telHref } from './pharmacyFilters.js';

const pharmacies = [
  { id: 'a', name: 'Lazz Pharma', address: 'Kalabagan', city: 'Dhaka', home_delivery: true },
  { id: 'b', name: 'Tamanna Pharmacy', address: 'Mirpur 10', city: 'Dhaka', home_delivery: false },
  { id: 'c', name: 'Popular Drugs', address: null, city: 'Chattogram', home_delivery: true },
];

test('search matches the name or the area, ignoring case and spaces', () => {
  assert.deepEqual(filterPharmacies(pharmacies, { query: ' lazz ' }).map(p => p.id), ['a']);
  assert.deepEqual(filterPharmacies(pharmacies, { query: 'mirpur  10' }).map(p => p.id), ['b']);
  assert.deepEqual(filterPharmacies(pharmacies, { query: 'chattogram' }).map(p => p.id), ['c']);
  assert.equal(filterPharmacies(pharmacies, { query: 'nowhere' }).length, 0);
});

test('home delivery keeps only pharmacies that deliver', () => {
  assert.deepEqual(filterPharmacies(pharmacies, { delivery: true }).map(p => p.id), ['a', 'c']);
  assert.deepEqual(filterPharmacies(pharmacies, { query: 'dhaka', delivery: true }).map(p => p.id), ['a']);
});

test('phone links dial Bangladesh numbers', () => {
  assert.equal(telHref('01711-112222'), 'tel:+8801711112222');
  assert.equal(telHref('+8801711112222'), 'tel:+8801711112222');
  assert.equal(telHref('8801711112222'), 'tel:+8801711112222');
  assert.equal(telHref('10600'), 'tel:10600');
});

test('medicine search matches name, strength or form', () => {
  const stock = [
    { id: '1', name: 'Napa', strength: '500 mg', form: 'Tablet' },
    { id: '2', name: 'Napa Extra', strength: null, form: null },
    { id: '3', name: 'Seclo', strength: '20 mg', form: 'Capsule' },
  ];
  assert.deepEqual(filterStock(stock, 'napa').map(i => i.id), ['1', '2']);
  assert.deepEqual(filterStock(stock, ' NAPA  500 ').map(i => i.id), ['1']);
  assert.deepEqual(filterStock(stock, 'capsule').map(i => i.id), ['3']);
  assert.equal(filterStock(stock, '').length, 3);
});

test('orders: open ones, and the newest per prescription', () => {
  const orders = [
    { id: 'a', prescription_id: 'p1', status: 'cancelled', created_at: '2026-11-01T10:00:00.000Z' },
    { id: 'b', prescription_id: 'p1', status: 'ready', created_at: '2026-11-02T10:00:00.000Z' },
    { id: 'c', prescription_id: 'p2', status: 'new', created_at: '2026-11-01T09:00:00.000Z' },
    { id: 'd', prescription_id: null, status: 'collected', created_at: '2026-11-03T09:00:00.000Z' },
  ];
  assert.deepEqual(orders.filter(isOpenOrder).map(o => o.id), ['b', 'c']);
  const latest = latestOrderByPrescription(orders);
  assert.equal(latest.p1.id, 'b');
  assert.equal(latest.p2.id, 'c');
  assert.equal(Object.keys(latest).length, 2);
});

test('order errors map to messages by code', () => {
  assert.equal(orderErrorKey({ code: 'ALREADY_SENT' }), 'po_err_already_sent');
  assert.equal(orderErrorKey({ code: 'ORDER_STATUS' }), 'po_err_status');
  assert.equal(orderErrorKey(new Error('offline')), 'po_err_generic');
});
