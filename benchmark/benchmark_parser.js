/* eslint-env mocha */

const { testData, fullPacketParser, lazyPacketParser } = require('../test/parser/prepareTests')
const Benchmark = require('benchmark')

function testValue (type, value, buffer) {
  it('fully parses packet', function () {
    const suite = new Benchmark.Suite()
    suite.add('parse full type', function () {
      fullPacketParser.parsePacketBuffer(buffer)
    })
      .on('cycle', function (event) {
        console.log(String(event.target))
      })
      .run({ 'async': false })
  })
  it('lazily parses packet', function () {
    const suite = new Benchmark.Suite()
    suite.add('parse "shallow" type', function () {
      lazyPacketParser.parsePacketBuffer(buffer)
    })
      .on('cycle', function (event) {
        console.log(String(event.target))
      })
      .run({ 'async': false })
  })
  it('lazily parses packet, then fully parses', function () {
    const suite = new Benchmark.Suite()
    suite.add('parse "shallow" type', function () {
      const parsed = lazyPacketParser.parsePacketBuffer(buffer)
      // access a property that doesn't exist in the shallow type to trigger
      // full parsing. The IIFE is just there to a avoid an "assigned but never
      // used" warning
      ;(() => parsed.result)()
    })
      .on('cycle', function (event) {
        console.log(String(event.target))
      })
      .run({ 'async': false })
  })
}

function testType (type, values) {
  values.forEach((value) => {
    if (value.description) {
      describe(value.description, () => {
        testValue(type, value.value, value.buffer)
      })
    } else { testValue(type, value.value, value.buffer) }
  })
}

testData.forEach(tests => {
  describe(tests.kind, function () {
    this.timeout(1000 * 60 * 10)

    tests.data.forEach(test => {
      describe(test.type, () => {
        test.subtypes.forEach((subtype) => {
          if (subtype.description) {
            describe(subtype.description, () => {
              testType(subtype.type, subtype.values)
            })
          } else { testType(subtype.type, subtype.values) }
        })
      })
    })
  })
})
