const UUID = require('uuid-1345')

module.exports = {
  Read: {
    'UUID': ['native', (buffer, offset) => {
      return {
        value: UUID.stringify(buffer.slice(offset, 16 + offset)),
        size: 16
      }
    }],
    'restBuffer': ['native', (buffer, offset) => {
      return {
        value: buffer.slice(offset),
        size: buffer.length - offset
      }
    }],
    'entityMetadataLoop': ['parametrizable', (compiler, { type, endVal }) => {
      let code = 'let cursor = offset\n'
      code += 'const data = []\n'
      code += 'while (true) {\n'
      code += `  if (ctx.u8(buffer, cursor) === ${endVal}) return { value: data, size: cursor + 1 - offset }\n`
      code += '  const elem = ' + compiler.callType(type) + '\n'
      code += '  data.push(elem.value)\n'
      code += '  cursor += elem.size\n'
      code += '}'
      return compiler.wrapCode(code)
    }]
  },
  Write: {
    'UUID': ['native', (value, buffer, offset) => {
      const buf = UUID.parse(value)
      buf.copy(buffer, offset)
      return offset + 16
    }],
    'restBuffer': ['native', (value, buffer, offset) => {
      value.copy(buffer, offset)
      return offset + value.length
    }],
    'entityMetadataLoop': ['parametrizable', (compiler, { type, endVal }) => {
      let code = 'for (const i in value) {\n'
      code += '  offset = ' + compiler.callType('value[i]', type) + '\n'
      code += '}\n'
      code += `return offset + ctx.u8(${endVal}, buffer, offset)`
      return compiler.wrapCode(code)
    }]
  },
  SizeOf: {
    'UUID': ['native', 16],
    'restBuffer': ['native', (value) => {
      return value.length
    }],
    'entityMetadataLoop': ['parametrizable', (compiler, { type }) => {
      let code = 'let size = 1\n'
      code += 'for (const i in value) {\n'
      code += '  size += ' + compiler.callType('value[i]', type) + '\n'
      code += '}\n'
      code += `return size`
      return compiler.wrapCode(code)
    }]
  }
}