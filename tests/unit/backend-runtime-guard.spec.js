import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertLease,
  assertArchive,
  safeFailure,
  candidateOperations,
  mongoToolsUri,
  backupRestoreNames,
  candidateStageNames,
  assertStageOwner,
  candidateEnvironment,
  assertStageListener,
  identityMigrationNames,
  assertIdentityDefinitions,
  identityIndexMatches,
  assertIdentityRecoveryShape,
  assertDesktopRetentionDefinitions,
  assertDesktopRetentionRecoveryShape,
  assertIdentityPredecessor,
  stageCompiledFiles,
  identityMetadata,
  desktopRetentionMetadata
} from '../../deploy/tencent/scripts/prepare-backend.mjs';
import {
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation
} from '../../laf-backend/functions/_shared/learning-domain.js';

describe('backend preparation admission', () => {
  const lease = { id: 'a'.repeat(32), phase: 'applying', deadline: Date.now() / 1000 + 60 };
  it('rejects direct, expired and previously accepted mutations', () => {
    expect(() => assertLease({}, 'prepare')).toThrow();
    expect(() => assertLease({ ...lease, deadline: 0 }, 'prepare')).toThrow();
    expect(() => assertLease({ ...lease, phase: 'accepted' }, 'prepare')).toThrow();
    expect(() => assertLease(lease, 'prepare')).not.toThrow();
    expect(() => assertLease({ ...lease, phase: 'recovering' }, 'recover')).not.toThrow();
  });
  it('backup restoration requires the applying lease and recovery requires its own phase', () => {
    expect(() => assertLease(lease, 'verify-backup')).not.toThrow();
    expect(() => assertLease({ ...lease, deadline: 0 }, 'verify-backup')).toThrow();
    expect(() => assertLease({ ...lease, phase: 'accepted' }, 'verify-backup')).toThrow();
    expect(() => assertLease(lease, 'recover-backup')).toThrow();
    expect(() => assertLease({ ...lease, phase: 'recovering' }, 'recover-backup')).not.toThrow();
    expect(() => assertLease(lease, 'unknown')).toThrow();
  });
  it('disposable restoration cannot select the primary container or a foreign directory', () => {
    for (const id of ['', '../main', 'a'.repeat(31), 'A'.repeat(32), 'b'.repeat(33)]) {
      expect(() => backupRestoreNames(id)).toThrow();
    }
    const a = backupRestoreNames(lease.id);
    const b = backupRestoreNames('b'.repeat(32));
    expect(a.container).not.toBe('wenli-mongo');
    expect(a.container).not.toBe(b.container);
    expect(a.root).toBe('/var/lib/vps-config/exam-master/restore-' + lease.id);
    expect(a.root).not.toBe(b.root);
  });
  it('candidate staging cannot run directly or recover during an active apply', () => {
    expect(() => assertLease(lease, 'stage-candidate')).not.toThrow();
    expect(() => assertLease({ ...lease, deadline: 0 }, 'stage-candidate')).toThrow();
    expect(() => assertLease({ ...lease, phase: 'accepted' }, 'stage-candidate')).toThrow();
    expect(() => assertLease(lease, 'recover-candidate')).toThrow();
    for (const phase of ['recovering', 'awaiting-local-restore', 'rolled-back']) {
      expect(() => assertLease({ ...lease, phase }, 'recover-candidate')).not.toThrow();
    }
  });
  it('staging namespaces use the entire transaction and cannot address primary data', () => {
    const candidateSha = 'c'.repeat(64);
    for (const id of ['', '../main', 'a'.repeat(31), 'A'.repeat(32)]) {
      expect(() => candidateStageNames(id, candidateSha)).toThrow();
    }
    for (const value of ['', '../release', 'c'.repeat(63), 'C'.repeat(64)]) {
      expect(() => candidateStageNames(lease.id, value)).toThrow();
    }
    const names = candidateStageNames(lease.id, candidateSha);
    expect(names.database).toBe('wenli_candidate_' + lease.id);
    expect(names.database).not.toBe(candidateStageNames('a'.repeat(31) + 'b', candidateSha).database);
    expect(names.root).toBe('/var/lib/vps-config/exam-master/stage-' + lease.id);
    expect(names.release).toBe('/opt/vps-config/releases/exam-master/' + 'c'.repeat(16));
    expect(names.root).not.toBe('/var/lib/vps-config/exam-master');
  });
  it('recovery refuses a foreign transaction, a truncated-SHA collision or the prepared root owner', () => {
    const candidateSha = 'c'.repeat(64);
    const record = { transaction: lease.id, candidateSha, preparedTransaction: 'b'.repeat(32) };
    expect(() => assertStageOwner(record, lease.id, candidateSha)).not.toThrow();
    expect(() => assertStageOwner({ ...record, transaction: 'b'.repeat(32) }, lease.id, candidateSha)).toThrow();
    expect(() => assertStageOwner({ ...record, candidateSha: 'c'.repeat(63) + 'd' }, lease.id, candidateSha)).toThrow();
    expect(() => assertStageOwner({ ...record, preparedTransaction: lease.id }, lease.id, candidateSha)).toThrow();
  });
  const isolatedEnvironment = () => {
    const names = candidateStageNames(lease.id, 'c'.repeat(64));
    return {
      uri: 'mongodb://candidate:synthetic-password@127.0.0.1:27019/' + names.database + '?authSource=' + names.database,
      database: names.database,
      storage: names.root + '/storage',
      jwtSecret: '1'.repeat(64),
      adminSecret: '2'.repeat(64),
      vaultKey: '3'.repeat(64)
    };
  };
  it('isolated candidate never inherits actual provider, SMTP or OAuth configuration', () => {
    const prior = process.env.QQ_MINI_SECRET;
    process.env.QQ_MINI_SECRET = 'synthetic-should-not-be-inherited';
    try {
      const env = candidateEnvironment(isolatedEnvironment());
      expect(env).not.toHaveProperty('QQ_MINI_SECRET');
      expect(env).not.toHaveProperty('WX_MOBILE_APPSECRET');
      expect(env).not.toHaveProperty('SMTP_HOST');
      expect(env.LEARNING_PLATFORM_CALLS_ENABLED).toBe('false');
      expect(env.LEARNING_PAYMENT_SANDBOX_ENABLED).toBe('false');
      expect(env.HOST).toBe('127.0.0.1');
    } finally {
      if (prior === undefined) delete process.env.QQ_MINI_SECRET;
      else process.env.QQ_MINI_SECRET = prior;
    }
  });
  it('isolated credentials and storage cannot select primary, external or mismatched namespaces', () => {
    const env = isolatedEnvironment();
    for (const uri of [
      env.uri.replace('127.0.0.1', 'example.com'),
      env.uri.replace(':27019', ':27017'),
      env.uri.replace('/' + env.database + '?', '/exam-master?'),
      env.uri.replace('authSource=' + env.database, 'authSource=admin'),
      env.uri.replace('candidate:', 'operator:')
    ]) {
      expect(() => candidateEnvironment({ ...env, uri })).toThrow();
    }
    expect(() => candidateEnvironment({ ...env, storage: '/var/lib/vps-config/exam-master/storage' })).toThrow();
    expect(() => candidateEnvironment({ ...env, jwtSecret: 'weak' })).toThrow();
  });
  it('business validation requires this child to own the exact loopback listener', () => {
    const row = 'LISTEN 0 511 127.0.0.1:3002 0.0.0.0:* users:(("node",pid=1234,fd=29))';
    expect(() => assertStageListener(row, 1234)).not.toThrow();
    expect(() => assertStageListener(row, 123)).toThrow();
    expect(() => assertStageListener(row.replace('127.0.0.1', '0.0.0.0'), 1234)).toThrow();
    expect(() => assertStageListener(row + '\n' + row, 1234)).toThrow();
    expect(() => assertStageListener('', 1234)).toThrow();
  });
  const identityDefinitions = () => [
    {
      key: { wx_mobile_appid: 1, app_openid: 1 },
      options: {
        name: 'idx_wx_mobile_identity_unique',
        unique: true,
        partialFilterExpression: { wx_mobile_appid: { $type: 'string' }, app_openid: { $type: 'string' } }
      }
    },
    ...['openid', 'h5_openid', 'unionid', 'qq_openid', 'qq_unionid'].map((field) => ({
      key: { [field]: 1 },
      options: { name: 'idx_' + field + '_unique', unique: true, sparse: true }
    })),
    ...['mobile', 'mini'].map((kind) => ({
      key: { ['qq_' + kind + '_appid']: 1, ['qq_' + kind + '_openid']: 1 },
      options: {
        name: 'idx_qq_' + kind + '_identity_unique',
        unique: true,
        partialFilterExpression: {
          ['qq_' + kind + '_appid']: { $type: 'string' },
          ['qq_' + kind + '_openid']: { $type: 'string' }
        }
      }
    })),
    {
      key: { wx_web_appid: 1, web_openid: 1 },
      options: {
        name: 'idx_wx_web_identity_unique',
        unique: true,
        partialFilterExpression: { wx_web_appid: { $type: 'string' }, web_openid: { $type: 'string' } }
      }
    }
  ];
  const actualIndex = (definition) => ({ v: 2, key: definition.key, ...definition.options });
  const originalUserIndexes = () => [
    { v: 2, key: { _id: 1 }, name: '_id_' },
    { v: 2, key: { email: 1 }, name: 'email_1', unique: true, sparse: true }
  ];
  it('primary identity changes and recovery require the correct current lease phase', () => {
    expect(() => assertLease(lease, 'migrate-identities')).not.toThrow();
    expect(() => assertLease({ ...lease, phase: 'accepted' }, 'migrate-identities')).toThrow();
    expect(() => assertLease({ ...lease, deadline: 0 }, 'migrate-identities')).toThrow();
    expect(() => assertLease(lease, 'recover-identities')).toThrow();
    expect(() => assertLease({ ...lease, phase: 'awaiting-local-restore' }, 'recover-identities')).not.toThrow();
    expect(() => identityMigrationNames('../mongodb')).toThrow();
    expect(identityMigrationNames(lease.id).root).toBe('/var/lib/vps-config/exam-master/identities-' + lease.id);
  });
  it('migration cannot select email, arbitrary fields, nonunique or weakened identity indexes', () => {
    const definitions = identityDefinitions();
    expect(() => assertIdentityDefinitions(definitions)).not.toThrow();
    for (const mutate of [
      (rows) => {
        rows[0].key = { email: 1 };
      },
      (rows) => {
        rows[0].options.unique = false;
      },
      (rows) => {
        rows[0].options.partialFilterExpression.app_openid.$type = 'number';
      },
      (rows) => {
        rows[0].options.partialFilterExpression = { arbitrary: { $type: 'string' } };
      },
      (rows) => {
        rows[0].options.expireAfterSeconds = 0;
      },
      (rows) => {
        rows.pop();
      }
    ]) {
      const changed = structuredClone(definitions);
      mutate(changed);
      expect(() => assertIdentityDefinitions(changed)).toThrow();
    }
  });
  it('old eight-index receipts remain explicitly readable while all new definitions require the website constraint', () => {
    const old = identityDefinitions().slice(0, -1);
    expect(() => assertIdentityDefinitions(old)).toThrow();
    expect(() => assertIdentityDefinitions(old, { legacy: true })).not.toThrow();
    expect(() => assertIdentityDefinitions(identityDefinitions(), { legacy: true })).toThrow();
    const names = identityMigrationNames(lease.id, 'c'.repeat(64));
    expect(names.report).toBe('/var/lib/vps-config/exam-master/identity-indexes-applied-' + 'c'.repeat(64) + '.json');
    expect(names.report).not.toBe(identityMigrationNames(lease.id).report);
    expect(() => identityMigrationNames(lease.id, '../old')).toThrow();
  });
  it('index names cannot be reused for a different permitted identity key or collation', () => {
    const changed = identityDefinitions();
    changed[8].key = { wx_mobile_appid: 1, app_openid: 1 };
    changed[8].options.partialFilterExpression = changed[0].options.partialFilterExpression;
    expect(() => assertIdentityDefinitions(changed)).toThrow();
    const reordered = identityDefinitions();
    reordered[8].key = { web_openid: 1, wx_web_appid: 1 };
    expect(() => assertIdentityDefinitions(reordered)).toThrow();
    expect(
      identityIndexMatches(
        { ...actualIndex(identityDefinitions()[8]), collation: { locale: 'en' } },
        identityDefinitions()[8]
      )
    ).toBe(false);
  });
  it('a nine-index extension keeps all eight accepted constraints and recovers only the website addition', () => {
    const definitions = identityDefinitions();
    const before = originalUserIndexes().concat(definitions.slice(0, -1).map(actualIndex));
    expect(assertIdentityRecoveryShape(before, before.concat(actualIndex(definitions[8])), definitions)).toEqual([
      'idx_wx_web_identity_unique'
    ]);
    expect(before.map((index) => index.name)).toHaveLength(10);
    expect(() =>
      assertIdentityRecoveryShape(before, before.slice(0, -1).concat(actualIndex(definitions[8])), definitions)
    ).toThrow();
  });
  it('MongoDB default simple collation is compatible without changing the frozen original index metadata', () => {
    const definitions = identityDefinitions();
    const withSimple = (index) => ({ ...index, collation: { locale: 'simple' } });
    const before = originalUserIndexes().concat(definitions.slice(0, -1).map(actualIndex)).map(withSimple);
    const frozen = structuredClone(before);
    expect(identityIndexMatches(withSimple(actualIndex(definitions[8])), definitions[8])).toBe(true);
    expect(
      assertIdentityRecoveryShape(before, before.concat(withSimple(actualIndex(definitions[8]))), definitions)
    ).toEqual(['idx_wx_web_identity_unique']);
    expect(before).toEqual(frozen);
    const changed = structuredClone(before);
    delete changed[1].collation;
    expect(() => assertIdentityRecoveryShape(before, changed, definitions)).toThrow();
    for (const collation of [{}, { locale: 'en' }, { locale: 'simple', strength: 1 }, null])
      expect(identityIndexMatches({ ...actualIndex(definitions[8]), collation }, definitions[8])).toBe(false);
  });
  const retentionDefinitions = () => [
    { key: { expires_at: 1 }, options: { expireAfterSeconds: 0, name: 'idx_desktop_oauth_expiry' } }
  ];
  const absentRetention = () => ({ exists: false, count: 0, indexes: [] });
  const currentRetention = () => ({
    exists: true,
    count: 0,
    indexes: [originalUserIndexes()[0], actualIndex(retentionDefinitions()[0])]
  });
  it('short-term retention accepts only its exact expiry field, duration and index name', () => {
    expect(() => assertDesktopRetentionDefinitions(retentionDefinitions())).not.toThrow();
    for (const definitions of [
      [{ key: { created_at: 1 }, options: retentionDefinitions()[0].options }],
      [{ ...retentionDefinitions()[0], options: { ...retentionDefinitions()[0].options, expireAfterSeconds: 600 } }],
      [{ ...retentionDefinitions()[0], options: { ...retentionDefinitions()[0].options, unique: true } }],
      retentionDefinitions().concat(retentionDefinitions())
    ])
      expect(() => assertDesktopRetentionDefinitions(definitions)).toThrow();
  });
  it('retention recovery removes only its new index and only marks a new empty collection for removal', () => {
    expect(assertDesktopRetentionRecoveryShape(absentRetention(), currentRetention(), retentionDefinitions())).toEqual({
      createdNames: ['idx_desktop_oauth_expiry'],
      dropCreatedCollection: true
    });
    const before = { exists: true, count: 0, indexes: [originalUserIndexes()[0]] };
    expect(assertDesktopRetentionRecoveryShape(before, currentRetention(), retentionDefinitions())).toEqual({
      createdNames: ['idx_desktop_oauth_expiry'],
      dropCreatedCollection: false
    });
    expect(assertDesktopRetentionRecoveryShape(currentRetention(), currentRetention(), retentionDefinitions())).toEqual(
      { createdNames: [], dropCreatedCollection: false }
    );
    expect(assertDesktopRetentionRecoveryShape(absentRetention(), absentRetention(), retentionDefinitions())).toEqual({
      createdNames: [],
      dropCreatedCollection: false
    });
  });
  it('new retention indexes accept the explicit binary default while existing metadata remains exact', () => {
    const current = currentRetention();
    current.indexes = current.indexes.map((index) => ({ ...index, collation: { locale: 'simple' } }));
    const frozen = structuredClone(current);
    expect(assertDesktopRetentionRecoveryShape(absentRetention(), current, retentionDefinitions())).toEqual({
      createdNames: ['idx_desktop_oauth_expiry'],
      dropCreatedCollection: true
    });
    const before = { ...current, indexes: current.indexes.slice(0, 1) };
    expect(assertDesktopRetentionRecoveryShape(before, current, retentionDefinitions())).toEqual({
      createdNames: ['idx_desktop_oauth_expiry'],
      dropCreatedCollection: false
    });
    expect(current).toEqual(frozen);
    const changed = structuredClone(current);
    delete changed.indexes[0].collation;
    expect(() => assertDesktopRetentionRecoveryShape(before, changed, retentionDefinitions())).toThrow();
    for (const position of [0, 1]) {
      for (const collation of [{}, { locale: 'en' }, { locale: 'simple', strength: 1 }, null]) {
        const invalid = structuredClone(current);
        invalid.indexes[position].collation = collation;
        expect(() => assertDesktopRetentionRecoveryShape(absentRetention(), invalid, retentionDefinitions())).toThrow();
      }
    }
  });
  it('collection metadata admits only the ordinary collection with its equivalent explicit simple default', async () => {
    const clients = (options) => ({
      app: {
        db: (name) => {
          expect(name).toBe('exam-master');
          return {
            listCollections: (filter) => ({
              toArray: async () => [{ name: filter?.name || 'users', type: 'collection', options }]
            }),
            collection: () => ({
              countDocuments: async () => 0,
              indexes: async () => originalUserIndexes()
            })
          };
        }
      }
    });
    for (const options of [{}, { collation: { locale: 'simple' } }]) {
      await expect(identityMetadata(clients(options))).resolves.toEqual(originalUserIndexes());
      await expect(desktopRetentionMetadata(clients(options))).resolves.toEqual({
        exists: true,
        count: 0,
        indexes: originalUserIndexes()
      });
    }
    for (const options of [
      { collation: { locale: 'en' } },
      { collation: { locale: 'simple', strength: 1 } },
      { collation: {} },
      { collation: { locale: 'simple' }, validator: {} },
      { capped: true }
    ]) {
      await expect(identityMetadata(clients(options))).rejects.toThrow();
      await expect(desktopRetentionMetadata(clients(options))).rejects.toThrow();
    }
  });
  it('retention recovery refuses records, foreign indexes, changed metadata and lost original collection', () => {
    for (const state of [
      { ...currentRetention(), count: 1 },
      { ...currentRetention(), indexes: currentRetention().indexes.concat({ v: 2, key: { x: 1 }, name: 'foreign' }) },
      {
        ...currentRetention(),
        indexes: [originalUserIndexes()[0], { ...actualIndex(retentionDefinitions()[0]), expireAfterSeconds: 60 }]
      },
      {
        ...currentRetention(),
        indexes: [originalUserIndexes()[0], { ...actualIndex(retentionDefinitions()[0]), unique: true }]
      }
    ])
      expect(() => assertDesktopRetentionRecoveryShape(absentRetention(), state, retentionDefinitions())).toThrow();
    expect(() =>
      assertDesktopRetentionRecoveryShape(currentRetention(), absentRetention(), retentionDefinitions())
    ).toThrow();
  });
  it('new accepted state must descend from the old prepared owner and exact non-index/database snapshot', () => {
    const previous = {
      transaction: 'b'.repeat(32),
      preparedTransaction: 'a'.repeat(32),
      candidateSha: 'c'.repeat(64),
      definitions: identityDefinitions().slice(0, -1),
      scope: 'user-identities',
      afterSnapshot: { databaseSha256: 'd'.repeat(64), legacyPid: 123 },
      actualScopedMigrationAndIdempotency: true,
      userDocumentsModified: false,
      publicEntrySwitched: false,
      upstreamProviderCalls: 0,
      upstreamModelCalls: 0
    };
    const next = {
      preparedTransaction: previous.preparedTransaction,
      definitions: identityDefinitions(),
      beforeSnapshot: previous.afterSnapshot
    };
    expect(() => assertIdentityPredecessor(previous, next)).not.toThrow();
    for (const change of [
      { preparedTransaction: 'f'.repeat(32) },
      { afterSnapshot: { ...previous.afterSnapshot, legacyPid: 456 } },
      { publicEntrySwitched: true },
      { userDocumentsModified: true },
      { upstreamProviderCalls: 1 },
      { actualScopedMigrationAndIdempotency: false }
    ])
      expect(() => assertIdentityPredecessor({ ...previous, ...change }, next)).toThrow();
  });
  it('regional creation retires only QQ definitions while all original QQ indexes remain protected', () => {
    const historical = identityDefinitions();
    const regional = historical
      .filter((row) => !row.options.name.startsWith('idx_qq_'))
      .concat(
        ['apple', 'google'].map((provider) => ({
          key: { [`${provider}_client_id`]: 1, [`${provider}_sub`]: 1 },
          options: {
            name: `idx_${provider}_identity_unique`,
            unique: true,
            partialFilterExpression: {
              [`${provider}_client_id`]: { $type: 'string' },
              [`${provider}_sub`]: { $type: 'string' }
            }
          }
        })),
        { key: { phone: 1 }, options: { name: 'idx_phone_unique', unique: true, sparse: true } }
      );
    const previous = {
      transaction: 'b'.repeat(32),
      preparedTransaction: 'a'.repeat(32),
      candidateSha: 'c'.repeat(64),
      contractVersion: 'wenli-backend-stage-v2',
      definitions: historical,
      scope: 'user-identities',
      afterSnapshot: { databaseSha256: 'd'.repeat(64) },
      actualScopedMigrationAndIdempotency: true,
      userDocumentsModified: false,
      publicEntrySwitched: false,
      upstreamProviderCalls: 0,
      upstreamModelCalls: 0
    };
    expect(() =>
      assertIdentityPredecessor(previous, {
        preparedTransaction: previous.preparedTransaction,
        definitions: regional,
        beforeSnapshot: previous.afterSnapshot
      })
    ).not.toThrow();
    const before = originalUserIndexes().concat(historical.map(actualIndex));
    const after = before.concat(regional.slice(-3).map(actualIndex));
    expect(assertIdentityRecoveryShape(before, after, regional)).toEqual([
      'idx_apple_identity_unique',
      'idx_google_identity_unique',
      'idx_phone_unique'
    ]);
    expect(() =>
      assertIdentityRecoveryShape(
        before,
        after.filter((row) => row.name !== 'idx_qq_openid_unique'),
        regional
      )
    ).toThrow();
    const invalid = structuredClone(regional);
    invalid.at(-1).options.unique = false;
    expect(() => assertIdentityDefinitions(invalid)).toThrow();
  });
  it('current stage receipts fingerprint shared auth modules and refuse symlinked payloads', () => {
    const root = fs.mkdtempSync(path.resolve('tmp/backend-stage-fingerprint-'));
    try {
      const files = [
        'package.json',
        'package-lock.json',
        '.env.example',
        'ecosystem.config.cjs',
        'dist/standalone/server.js',
        'dist/standalone/cloud-shim.js',
        'dist/functions/login.js',
        'dist/functions/db-create-indexes.js',
        'dist/functions/_shared/desktop-oauth.js',
        ...Array.from({ length: 20 }, (_, i) => 'dist/functions/module-' + i + '.js')
      ];
      for (const name of files) {
        fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
        fs.writeFileSync(path.join(root, name), 'synthetic module');
      }
      const first = stageCompiledFiles(root);
      expect(Object.keys(first)).toHaveLength(files.length);
      fs.writeFileSync(path.join(root, 'dist/functions/_shared/desktop-oauth.js'), 'changed synthetic guard');
      expect(stageCompiledFiles(root)['dist/functions/_shared/desktop-oauth.js']).not.toBe(
        first['dist/functions/_shared/desktop-oauth.js']
      );
      fs.symlinkSync(path.join(root, 'package.json'), path.join(root, 'dist/functions/foreign.js'));
      expect(() => stageCompiledFiles(root)).toThrow();
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });
  it('partial recovery selects only new matching identity indexes and leaves original email/_id intact', () => {
    const before = originalUserIndexes();
    const definitions = identityDefinitions();
    const current = before.concat(definitions.slice(0, 3).map(actualIndex));
    const created = assertIdentityRecoveryShape(before, current, definitions);
    expect(created).toEqual(definitions.slice(0, 3).map((row) => row.options.name));
    expect(created).not.toContain('email_1');
    expect(created).not.toContain('_id_');
    expect(assertIdentityRecoveryShape(before, before, definitions)).toEqual([]);
    expect(identityIndexMatches(current[2], definitions[0])).toBe(true);
    expect(identityIndexMatches({ ...current[2], unique: false }, definitions[0])).toBe(false);
  });
  it('recovery rejects concurrently changed original indexes or foreign additions', () => {
    const before = originalUserIndexes();
    const definitions = identityDefinitions();
    expect(() =>
      assertIdentityRecoveryShape(
        before,
        before.map((row) => (row.name === 'email_1' ? { ...row, unique: false } : row)),
        definitions
      )
    ).toThrow();
    expect(() =>
      assertIdentityRecoveryShape(
        before,
        before.concat({ v: 2, key: { nickname: 1 }, name: 'customer-index' }),
        definitions
      )
    ).toThrow();
    expect(() =>
      assertIdentityRecoveryShape(before, before.concat({ ...actualIndex(definitions[0]), unique: false }), definitions)
    ).toThrow();
    expect(() => assertIdentityRecoveryShape(before, before.slice(1), definitions)).toThrow();
  });
  const rows = () =>
    Array.from({ length: 25 }, (_, i) => ({
      name: i ? `dist/functions/f${i}.js` : 'dist/standalone/server.js',
      size: 128,
      type: 'file'
    }));
  it.each(['../.env', '/tmp/evil', 'dist/../.env', 'node_modules/pkg.js', 'dist//file.js', '.env'])(
    'rejects unowned member %s',
    (name) => {
      expect(() => assertArchive(rows().concat({ name, size: 1, type: 'file' }))).toThrow();
    }
  );
  it('rejects symlinks, duplicate paths, expansion and missing entry', () => {
    expect(() => assertArchive(rows().concat({ name: 'dist/link', type: 'symlink', size: 1 }))).toThrow();
    expect(() => assertArchive(rows().concat(rows()[0]))).toThrow();
    expect(() => assertArchive(rows().map((row) => ({ ...row, size: 2_000_000 })))).toThrow();
    expect(() => assertArchive(rows().slice(1))).toThrow();
    expect(() => assertArchive(rows())).not.toThrow();
  });
  it('redacts native credentials and reports only an allowlisted source location', () => {
    const error = new Error('mongodb://operator:private-secret@localhost');
    error.stack =
      error.message +
      '\n    at run (file:///private/prepare-backend.mjs:49:3)\n    at prepare (file:///private/prepare-backend.mjs:123:5)';
    expect(safeFailure(error)).toBe('RuntimeError\n  File "<stdin>", line 123');
    expect(safeFailure({ name: 'unknown', message: 'private-secret' })).toBe('RuntimeError');
  });
  it('backup authentication does not override the explicitly selected business database', () => {
    const uri = new URL(mongoToolsUri('operator', 'synthetic:@/?'));
    expect(uri.pathname).toBe('/');
    expect(uri.searchParams.get('authSource')).toBe('admin');
    expect(decodeURIComponent(uri.password)).toBe('synthetic:@/?');
  });
  it('candidate fixture uses independently derived grading and preserves a real wrong answer', () => {
    const operations = candidateOperations(Date.now()).map(normalizePrivateSyncOperation);
    expect(operations[1].data.question.validation.answer).toBe('20');
    let state = emptyLearningState('isolated-candidate');
    for (const operation of operations) state = applyLearningOperation(state, operation).state;
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0].grade).toMatchObject({ outcome: 'wrong', status: 'reliable' });
    const unsupported = candidateOperations(Date.now())[1];
    unsupported.data.question.prompt = '计算12+8。';
    expect(normalizePrivateSyncOperation(unsupported).data.question.validation).toBeNull();
  });
});
