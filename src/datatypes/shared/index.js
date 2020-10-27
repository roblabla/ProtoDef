const numeric = require('./numeric')
const utils = require('./utils')

// There's no need to compile these types, just optimize it instead
module.exports = { ...numeric, ...utils }
