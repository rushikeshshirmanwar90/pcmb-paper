// Workspaces: which one opens, what requests send, and that a saved choice
// can never open a workspace the account doesn't have.
//   node --experimental-strip-types --test tests/workspace-switch.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { apiWorkspaceFor, resolveWorkspace, workspaceKey, workspacesFor } from '../src/services/workspace.ts';

const BOTH = ['tuition', 'teacher'];

describe('workspaces', () => {
  test('a tuition admin reopens the workspace used last, per user and institute', () => {
    assert.equal(resolveWorkspace('tuition', BOTH, 'teacher'), 'teacher');
    assert.equal(resolveWorkspace('tuition', BOTH, 'tuition'), 'tuition');
    assert.equal(resolveWorkspace('tuition', BOTH, null), 'tuition');
    assert.notEqual(workspaceKey('u1', 't1'), workspaceKey('u1', 't2'));
    assert.notEqual(workspaceKey('u1', 't1'), workspaceKey('u2', 't1'));
  });

  test('a saved workspace the account cannot open is ignored', () => {
    assert.equal(resolveWorkspace('teacher', ['teacher'], 'tuition'), 'teacher');
    assert.equal(resolveWorkspace('student', ['student'], 'teacher'), 'student');
    // Older servers send no list: only the account's own role.
    assert.equal(resolveWorkspace('tuition', undefined, 'teacher'), 'tuition');
    assert.equal(resolveWorkspace(null, undefined, 'teacher'), null);
  });

  test('only accounts with more than one workspace get the selector', () => {
    assert.equal(workspacesFor('tuition', BOTH).length, 2);
    assert.equal(workspacesFor('teacher', ['teacher']).length, 1);
    assert.equal(workspacesFor('student').length, 1);
    assert.equal(workspacesFor('tuition').length, 1);
  });

  test('requests carry a workspace only for a tuition admin in the Teacher workspace', () => {
    assert.equal(apiWorkspaceFor('tuition', 'teacher'), 'teacher');
    assert.equal(apiWorkspaceFor('tuition', 'tuition'), null);
    assert.equal(apiWorkspaceFor('teacher', 'teacher'), null);
    assert.equal(apiWorkspaceFor('student', 'teacher'), null);
  });
});
