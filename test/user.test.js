'use strict'

const t = require('tap')
const MongoClient = require('mongodb').MongoClient

const Fastify = require('fastify')
const example = require('../index')

const config = require('./config')
const { registerUsers, login } = require('./test-util')

t.test('user', async t => {
  const mongoClient = await MongoClient.connect(config.MONGODB_URL, {useNewUrlParser: true})
  await mongoClient.db('test').dropDatabase()
  t.tearDown(() => mongoClient.close())

  const fastify = Fastify({ logger: { level: 'silent' } })
  fastify.register(example, config)
  t.tearDown(() => fastify.close())

  t.plan(2)

  t.test('registration + login + me', async t => {
    t.plan(7)

    const USERNAME = 'the-user-1'
    const PASSWORD = 'the-password'

    const regRes = await fastify.inject({
      method: 'POST',
      url: '/api/user/register',
      headers: {
        'Content-type': 'application/json'
      },
      payload: JSON.stringify({
        username: USERNAME,
        password: PASSWORD
      })
    })
    t.equal(200, regRes.statusCode, regRes.payload)
    const { userId } = JSON.parse(regRes.payload)

    const loginRes = await fastify.inject({
      method: 'POST',
      url: '/api/user/login',
      headers: {
        'Content-type': 'application/json'
      },
      payload: JSON.stringify({
        username: USERNAME,
        password: PASSWORD
      })
    })
    t.equal(200, loginRes.statusCode, loginRes.payload)
    const { jwt } = JSON.parse(loginRes.payload)

    const getMeRes = await fastify.inject({
      method: 'GET',
      url: '/api/user/me',
      headers: {
        'Content-type': 'application/json',
        'Authorization': 'Bearer ' + jwt
      }
    })
    t.equal(200, getMeRes.statusCode, getMeRes.payload)
    const { username, password, _id } = JSON.parse(getMeRes.payload)

    t.equal(USERNAME, username)
    t.equal(undefined, password)
    t.ok(_id)
    t.equal(_id, userId)
  })

  t.test('search', async t => {
    t.plan(11)

    const USERNAMES = [ 'user-foo-1', 'user-foo-2', 'user-foo-3', 'another-user' ]
    await registerUsers(t, fastify, USERNAMES)

    const jwt = await login(t, fastify, 'user-foo-1')

    const searchRes = await fastify.inject({
      method: 'GET',
      url: '/api/user/search?search=-foo-',
      headers: {
        'Authorization': 'Bearer ' + jwt
      }
    })
    t.equal(200, searchRes.statusCode, searchRes.payload)

    const users = JSON.parse(searchRes.payload)
    t.equal(3, users.length)

    t.ok(users.find(u => u.username === USERNAMES[0]))
    t.ok(users.find(u => u.username === USERNAMES[1]))
    t.ok(users.find(u => u.username === USERNAMES[2]))
    t.ok(!users.find(u => u.username === USERNAMES[3]))
  })
})
