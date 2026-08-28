import { describe, it, expect, vi, beforeEach } from "vitest"
import { _handlerForTests as registerHandler } from "../functions/api/auth/register.js"
import { _handlerForTests as loginHandler } from "../functions/api/auth/login.js"
import { _handlerForTests as pushHandler } from "../functions/api/sync/push.js"
import { _handlerForTests as pullHandler } from "../functions/api/sync/pull.js"
import { hashPassword } from "../functions/api/lib/_cf-auth.js"

function mockDb(state) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("FROM cf_users WHERE email")) {
                const email = args[0]
                return state.users.find((u) => u.email === email) || null
              }
              if (sql.includes("FROM cf_sync_snapshots")) {
                return state.snapshots.get(args[0]) || null
              }
              return null
            },
            async run() {
              if (sql.includes("INSERT INTO cf_users")) {
                state.users.push({
                  id: args[0],
                  email: args[1],
                  password_hash: args[2],
                  created_at: args[3]
                })
              }
              if (sql.includes("INSERT INTO cf_sync_snapshots")) {
                state.snapshots.set(args[0], {
                  user_id: args[0],
                  payload: args[1],
                  updated_at: args[2],
                  client_id: args[3]
                })
              }
              return { success: true }
            }
          }
        }
      }
    }
  }
}

describe("cf sync API handlers", () => {
  const secret = "unit-test-sync-secret"
  let state
  let env

  beforeEach(() => {
    state = { users: [], snapshots: new Map() }
    env = { SYNC_JWT_SECRET: secret, SYNC_DB: mockDb(state) }
  })

  it("register + login + push + pull roundtrip", async () => {
    const reg = await registerHandler(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "sync@test.dev", password: "password1" })
      }),
      env
    )
    expect(reg.status).toBe(200)
    const regBody = await reg.json()
    expect(regBody.token).toBeTruthy()
    expect(regBody.userId).toBeTruthy()

    const login = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "sync@test.dev", password: "password1" })
      }),
      env
    )
    expect(login.status).toBe(200)

    const payload = {
      v: 3,
      folders: [{ id: "f1", name: "Deck" }],
      cards: [{ id: "c1", front: "hi", back: "hey" }],
      settings: { algo: "sm2" },
      boxes: [],
      notes: []
    }

    const push = await pushHandler(
      new Request("http://localhost/api/sync/push", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Client-Id": "dev1" },
        body: JSON.stringify({ payload, base_updated_at: null })
      }),
      env,
      { cfUserId: regBody.userId }
    )
    expect(push.status).toBe(200)
    const pushBody = await push.json()
    expect(pushBody.updated_at).toBeGreaterThan(0)

    const pull = await pullHandler(
      new Request("http://localhost/api/sync/pull?since=0", { method: "GET" }),
      env,
      { cfUserId: regBody.userId }
    )
    expect(pull.status).toBe(200)
    const pullBody = await pull.json()
    expect(pullBody.payload.cards[0].front).toBe("hi")
  })

  it("push conflict when base_updated_at stale", async () => {
    const hash = await hashPassword("a@b.com", "password1")
    state.users.push({ id: "u1", email: "a@b.com", password_hash: hash, created_at: 1 })
    state.snapshots.set("u1", {
      user_id: "u1",
      payload: JSON.stringify({ v: 3, folders: [], cards: [], settings: {} }),
      updated_at: 5000,
      client_id: null
    })

    const payload = { v: 3, folders: [], cards: [{ id: "c", front: "x", back: "y" }], settings: {} }
    const res = await pushHandler(
      new Request("http://localhost/api/sync/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload, base_updated_at: 1000 })
      }),
      env,
      { cfUserId: "u1" }
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("conflict")
  })
})
