const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseOrThrow,
  registerSchema,
  loanApplicationSchema,
} = require('../src/utils/validators');

test('parseOrThrow returns validated registration payload', () => {
  const data = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'strongpass123',
    phone: '+2348000000000',
    accountType: 'admin',
  };
  const result = parseOrThrow(registerSchema, data);
  assert.equal(result.email, data.email);
  assert.equal(result.accountType, 'admin');
});

test('parseOrThrow throws on invalid registration', () => {
  assert.throws(
    () => parseOrThrow(registerSchema, { name: 'J', email: 'bad', password: '123' }),
    /Validation failed|email/
  );
});

test('loan application schema enforces numeric constraints', () => {
  const data = {
    amount: 100000,
    tenure: 12,
    income: 80000,
    employment: 'employed',
    purpose: 'personal',
  };
  const result = parseOrThrow(loanApplicationSchema, data);
  assert.equal(result.amount, 100000);
});

test('loan application schema rejects invalid amount', () => {
  assert.throws(() => {
    parseOrThrow(loanApplicationSchema, {
      amount: -1,
      tenure: 12,
      income: 80000,
      employment: 'employed',
      purpose: 'personal',
    });
  }, (err) => {
    assert.match(err.message, />=10000/);
    return true;
  });
});
