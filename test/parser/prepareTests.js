const ProtoDef = require('protodef').ProtoDef
const { FullPacketParser, LazyPacketParser } = require('protodef')
const { ProtoDefCompiler } = require('protodef').Compiler

const proto = new ProtoDef()
const compiler = new ProtoDefCompiler()

const testData = [
  {
    'kind': 'packet',
    'data': require('../../ProtoDef/test/packet.json')
  }
]

function arrayToBuffer (arr) {
  return Buffer.from(arr.map(e => parseInt(e)))
}

function transformValues (type, values) {
  return values.map(value => ({
    buffer: arrayToBuffer(value.buffer),
    value: type.indexOf('buffer') === 0 ? arrayToBuffer(value.value) : value.value,
    description: value.description
  }))
}

testData.forEach(tests => {
  tests.originalData = JSON.parse(JSON.stringify(tests.data))
  tests.data.forEach(test => {
    const subTypes = []
    test.subtypes.forEach((subtype, i) => {
      const type = test.type + '_' + i
      proto.addType(type, subtype.type)
      let types = {}
      types[type] = subtype.type
      compiler.addTypesToCompile(types)

      subtype.values = transformValues(test.type, subtype.values)
      subtype.type = type
      subTypes.push(subtype)
    })
    test.subtypes = subTypes
  })
})

const compiledProto = compiler.compileProtoDefSync()
const fullPacketParser = new FullPacketParser(compiledProto, 'packet')
const lazyPacketParser = new LazyPacketParser(compiledProto, 'packet', 'packet_shallow')

module.exports = {
  testData,
  proto,
  compiledProto: compiler.compileProtoDefSync(),
  fullPacketParser,
  lazyPacketParser
}
