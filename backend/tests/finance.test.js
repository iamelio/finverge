const test = require('node:test');
const assert = require('node:assert/strict');

const { calcInterestRate, monthlyPayment } = require('../src/utils/finance');

test('calcInterestRate applies tenure and purpose rules', () => {
  assert.equal(calcInterestRate(6, 'personal'), 0.125);
  assert.equal(calcInterestRate(18, 'personal'), 0.145);
  assert.equal(calcInterestRate(36, 'personal'), 0.165);
  assert.equal(calcInterestRate(12, 'business'), 0.155);
});

test('monthlyPayment handles zero rate and principal', () => {
  assert.equal(monthlyPayment(0, 0, 12), 0);
  assert.equal(monthlyPayment(12000, 0, 12), 1000);
});

test('monthlyPayment calculates amortized loans', () => {
  const payment = monthlyPayment(500000, 0.12, 12);
  assert.ok(payment > 44000 && payment < 45000, `Expected payment around 44k, received ${payment}`);
});

test('monthlyPayment guards against invalid tenure', () => {
  assert.equal(monthlyPayment(100000, 0.12, 0), 0);
});
