const { Enum: { CompilerTypeKind: { NATIVE } } } = require('../../utils')
const conditionalDatatypes = require('./conditional')
const structuresDatatypes = require('./structures')
const utilsDatatypes = require('./utils')
const sharedDatatypes = require('../shared')

module.exports = {
  Read: {
    ...conditionalDatatypes.Read,
    ...structuresDatatypes.Read,
    ...utilsDatatypes.Read
  },
  Write: {
    ...conditionalDatatypes.Write,
    ...structuresDatatypes.Write,
    ...utilsDatatypes.Write
  },
  SizeOf: {
    ...conditionalDatatypes.SizeOf,
    ...structuresDatatypes.SizeOf,
    ...utilsDatatypes.SizeOf
  }
}

for (const k in sharedDatatypes) {
  const [ read, write, sizeOf ] = sharedDatatypes[k]
  module.exports.Read[k] = [NATIVE, read]
  module.exports.Write[k] = [NATIVE, write]
  module.exports.SizeOf[k] = [NATIVE, sizeOf]
}
