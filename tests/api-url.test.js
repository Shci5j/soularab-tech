import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanApiBase, safeApiBase } from '../src/utils/apiUrl.js';

test('empty API base uses the current origin', () => {
  assert.equal(safeApiBase(''), '');
  assert.equal(safeApiBase('   '), '');
});

test('HTTPS origins are accepted and normalized', () => {
  assert.equal(safeApiBase('https://api.example.com/'), 'https://api.example.com');
  assert.equal(cleanApiBase('https://api.example.com///'), 'https://api.example.com');
});

test('local loopback HTTP is accepted for development', () => {
  assert.equal(safeApiBase('http://localhost:8000/'), 'http://localhost:8000');
  assert.equal(safeApiBase('http://127.0.0.1:8000'), 'http://127.0.0.1:8000');
  assert.equal(safeApiBase('http://[::1]:8000'), 'http://[::1]:8000');
});

test('plain HTTP to non-loopback hosts is rejected', () => {
  assert.throws(() => safeApiBase('http://api.example.com'), /must use HTTPS/);
  assert.throws(() => safeApiBase('http://192.168.1.20:8000'), /must use HTTPS/);
});

test('unsafe URL schemes and embedded credentials are rejected', () => {
  assert.throws(() => safeApiBase('javascript:alert(1)'));
  assert.throws(() => safeApiBase('https://user:password@api.example.com'));
});

test('paths, queries, and fragments are rejected', () => {
  assert.throws(() => safeApiBase('https://api.example.com/backend'));
  assert.throws(() => safeApiBase('https://api.example.com?token=secret'));
  assert.throws(() => safeApiBase('https://api.example.com#fragment'));
});
