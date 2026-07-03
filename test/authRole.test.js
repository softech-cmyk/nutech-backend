import assert from 'node:assert/strict';
import { normalizeUserRole } from '../src/controllers/authController.js';

const cases = [
  { phone: '9310400406', role: 'manager', expected: 'manager' },
  { phone: '9310400406', role: 'employee', expected: 'manager' },
  { phone: '9999999999', role: 'manager', expected: 'employee' },
  { phone: '9999999999', role: 'employee', expected: 'employee' },
];

for (const testCase of cases) {
  const actual = normalizeUserRole(testCase.phone, testCase.role);
  assert.equal(actual, testCase.expected, `${testCase.phone} / ${testCase.role}`);
}

console.log('auth role tests passed');
