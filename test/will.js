'use strict'

var Buffer = require('safe-buffer').Buffer
var test = require('tape').test
var memory = require('aedes-persistence')
var helper = require('./helper')
var aedes = require('../')
var aedesConfig = {}
var setup = helper.setup
var connect = helper.connect

function willConnect (s, opts, connected) {
  opts = opts || {}
  opts.will = {
    topic: 'mywill',
    payload: Buffer.from('last will'),
    qos: 0,
    retain: false
  }

  return connect(s, opts, connected)
}

test('delivers a will', function (t) {
  var broker = aedes(aedesConfig)
  var opts = {}
  // willConnect populates opts with a will
  var s = willConnect(setup(broker), opts)

  s.broker.mq.on('mywill', function (packet, cb) {
    t.equal(packet.topic, opts.will.topic, 'topic matches')
    t.deepEqual(packet.payload, opts.will.payload, 'payload matches')
    t.equal(packet.qos, opts.will.qos, 'qos matches')
    t.equal(packet.retain, opts.will.retain, 'retain matches')
    cb()
    t.end()
  })

  s.conn.destroy()
})

test('calling close two times should not deliver two wills', function (t) {
  t.plan(4)

  var broker = aedes(aedesConfig)
  var opts = {}

  broker.on('client', function (client) {
    client.close()
    client.close()
  })

  broker.mq.on('mywill', onWill)

  // willConnect populates opts with a will
  willConnect(setup(broker), opts)

  function onWill (packet, cb) {
    broker.mq.removeListener('mywill', onWill)
    broker.mq.on('mywill', t.fail.bind(t))
    t.equal(packet.topic, opts.will.topic, 'topic matches')
    t.deepEqual(packet.payload, opts.will.payload, 'payload matches')
    t.equal(packet.qos, opts.will.qos, 'qos matches')
    t.equal(packet.retain, opts.will.retain, 'retain matches')
    cb()
  }
})

test('delivers old will in case of a crash', function (t) {
  t.plan(7)

  var config = JSON.parse(JSON.stringify(aedesConfig))
  if (typeof config.persistence === 'undefined') {
    config.persistence = memory()
  }
  var will = {
    topic: 'mywill',
    payload: Buffer.from('last will'),
    qos: 0,
    retain: false
  }

  config.persistence.broker = {
    id: 'anotherBroker'
  }

  config.persistence.putWill({
    id: 'myClientId42'
  }, will, function (err) {
    t.error(err, 'no error')

    config.heartbeatInterval = 10 // ms, so that the will check happens fast!
    var broker = aedes(config)
    var start = Date.now()

    broker.mq.on('mywill', check)

    function check (packet, cb) {
      broker.mq.removeListener('mywill', check)
      t.ok(Date.now() - start >= 3 * config.heartbeatInterval, 'the will needs to be emitted after 3 heartbeats')
      t.equal(packet.topic, will.topic, 'topic matches')
      t.deepEqual(packet.payload, will.payload, 'payload matches')
      t.equal(packet.qos, will.qos, 'qos matches')
      t.equal(packet.retain, will.retain, 'retain matches')
      broker.mq.on('mywill', function (packet) {
        t.fail('the will must be delivered only once')
      })
      setTimeout(function () {
        broker.close(t.pass.bind(t, 'server closes'))
      }, 15)
      cb()
    }
  })
})

test('store the will in the persistence', function (t) {
  var opts = {
    clientId: 'abcde'
  }

  // willConnect populates opts with a will
  var broker = aedes(aedesConfig)
  var s = willConnect(setup(broker), opts)

  s.broker.persistence.getWill({
    id: opts.clientId
  }, function (err, packet) {
    t.error(err, 'no error')
    t.deepEqual(packet.topic, opts.will.topic, 'will topic matches')
    t.deepEqual(packet.payload, opts.will.payload, 'will payload matches')
    t.deepEqual(packet.qos, opts.will.qos, 'will qos matches')
    t.deepEqual(packet.retain, opts.will.retain, 'will retain matches')
    t.end()
  })
})
