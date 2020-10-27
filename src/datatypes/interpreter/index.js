const conditionalDatatypes = require('./conditional')
const structuresDatatypes = require('./structures')
const utilsDatatypes = require('./utils')
const sharedDatatypes = require('../shared')

module.exports = {
  ...conditionalDatatypes,
  ...structuresDatatypes,
  ...utilsDatatypes,
  ...sharedDatatypes
}
