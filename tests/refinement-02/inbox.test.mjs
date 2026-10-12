import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'

async function api(client) {
  const context = createContext({})
  const module = new SourceTextModule(await readFile(new URL('../../src/api/jobAgent.js', import.meta.url), 'utf8'), { context })
  await module.link(async (specifier) => {
    const exports = specifier.includes('supabase') ? { supabase: client } : { fromApplicationRow: (row) => row }
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace
}

test('RF-05 inbox initialization: eight callers return the same alias without overwriting settings', async () => {
  let row = null, reads = 0, release
  const gate = new Promise((resolve) => { release = resolve })
  const client = {
    from: () => ({
      select() { return this },
      eq() { return this },
      async maybeSingle() {
        const snapshot = row
        if (!snapshot) { if (++reads === 8) release(); await gate }
        return { data: snapshot, error: null }
      },
      async upsert(value, options) {
        assert.equal(options.onConflict, 'user_id')
        assert.equal(options.ignoreDuplicates, true)
        row ||= { id: 1, user_id: value.user_id, address_alias: 'synthetic-existing-alias', enabled: false }
        return { error: null }
      },
      async single() { return { data: row, error: null } },
    }),
  }
  const { createJobAlertInbox } = await api(client)
  const results = await Promise.all(Array.from({ length: 8 }, () => createJobAlertInbox('synthetic-user')))
  assert.ok(results.every((inbox) => inbox.id === 1 && inbox.addressAlias === row.address_alias && inbox.enabled === false))
  assert.equal((await createJobAlertInbox('synthetic-user')).addressAlias, row.address_alias)
})

test('RF-05 inbox initialization: real read/insert errors are propagated, not masked as conflicts', async () => {
  for (const stage of ['initial', 'insert', 'reread']) {
    const error = { message: 'Synthetic database failure' }
    const client = {
      from: () => ({
        select() { return this },
        eq() { return this },
        async maybeSingle() { return { data: null, error: stage === 'initial' ? error : null } },
        async upsert() { return { error: stage === 'insert' ? error : null } },
        async single() { return { data: null, error } },
      }),
    }
    const { createJobAlertInbox } = await api(client)
    await assert.rejects(createJobAlertInbox('synthetic-user'), (caught) => caught === error)
  }
})
