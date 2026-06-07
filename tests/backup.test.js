"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path   = require("path");
const fs     = require("fs");
const os     = require("os");

// ── Backup path resolution (path traversal prevention) ────────────────────
// Extract the resolution logic from backupController for isolated testing.
// The controller uses:
//   const resolved = path.resolve(BACKUP_DIR, relativePath);
//   if (!resolved.startsWith(path.resolve(BACKUP_DIR))) → reject
//
// We test the invariant directly without needing express.

function resolveBackupPath(backupDir, relativePath) {
  const resolved = path.resolve(backupDir, relativePath);
  if (!resolved.startsWith(path.resolve(backupDir) + path.sep) &&
      resolved !== path.resolve(backupDir)) {
    return null; // traversal detected
  }
  return resolved;
}

describe("backup path traversal prevention", () => {
  const backupDir = path.join(os.tmpdir(), "mc-test-backups");

  test("accepts a simple filename", () => {
    const r = resolveBackupPath(backupDir, "world_2026-01-01.tar.zst");
    assert.ok(r !== null);
    assert.ok(r.startsWith(backupDir));
  });

  test("accepts a nested path within the backup dir", () => {
    const r = resolveBackupPath(backupDir, "daily/world_2026-01-01.tar.zst");
    assert.ok(r !== null);
    assert.ok(r.startsWith(backupDir));
  });

  test("rejects a simple parent-directory traversal", () => {
    const r = resolveBackupPath(backupDir, "../etc/passwd");
    assert.strictEqual(r, null);
  });

  test("rejects an absolute path outside the backup dir", () => {
    const r = resolveBackupPath(backupDir, "/etc/passwd");
    assert.strictEqual(r, null);
  });

  test("rejects a deep traversal", () => {
    const r = resolveBackupPath(backupDir, "daily/../../secret.txt");
    assert.strictEqual(r, null);
  });

  test("accepts the backup dir itself (empty relative path)", () => {
    const r = resolveBackupPath(backupDir, ".");
    assert.ok(r !== null);
    assert.strictEqual(r, path.resolve(backupDir));
  });
});
