var config = require('./redis_mqemitter-redis_config')
var notBlocking = require('../../not-blocking')
notBlocking.aedesConfig = {persistence: config.aedesPersistenceRedis, mq: config.mqRedis}
var test = require('tape').test
test('completed not-blocking test with aedes-persistence-redis and mq-redis', function (t) {
  t.end()
})
test.onFinish(function () {
  process.exit()
})
