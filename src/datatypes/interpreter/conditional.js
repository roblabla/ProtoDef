const { getField, getFieldInfo, tryDoc, PartialReadError } = require('../../utils')
const schema = require('../../../ProtoDef/schemas/conditional.json')

function readSwitch (buffer, offset, { compareTo, fields, compareToValue, 'default': defVal }, rootNode) {
  compareTo = compareToValue !== undefined ? compareToValue : getField(compareTo, rootNode)
  if (fields[compareTo] === undefined) {
    compareTo = 'default'
    fields[compareTo] = defVal
    if (defVal === undefined) {
      throw new Error(`${compareTo} has no associated fieldInfo in switch`)
    }
  }
  const fieldInfo = getFieldInfo(fields[compareTo])
  return tryDoc(() => this.read(buffer, offset, fieldInfo, rootNode), compareTo)
}

function writeSwitch (value, buffer, offset, { compareTo, fields, compareToValue, 'default': defVal }, rootNode) {
  compareTo = compareToValue !== undefined ? compareToValue : getField(compareTo, rootNode)
  if (fields[compareTo] === undefined) {
    compareTo = 'default'
    fields[compareTo] = defVal
    if (defVal === undefined) {
      throw new Error(`${compareTo} has no associated fieldInfo in switch`)
    }
  }
  const fieldInfo = getFieldInfo(fields[compareTo])
  return tryDoc(() => this.write(value, buffer, offset, fieldInfo, rootNode), compareTo)
}

function sizeOfSwitch (value, { compareTo, fields, compareToValue, 'default': defVal }, rootNode) {
  compareTo = compareToValue !== undefined ? compareToValue : getField(compareTo, rootNode)
  if (fields[compareTo] === undefined) {
    compareTo = 'default'
    fields[compareTo] = defVal
    if (defVal === undefined) {
      throw new Error(`${compareTo} has no associated fieldInfo in switch`)
    }
  }
  const fieldInfo = getFieldInfo(fields[compareTo])
  return tryDoc(() => this.sizeOf(value, fieldInfo, rootNode), compareTo)
}

function readOption (buffer, offset, typeArgs, context) {
  if (buffer.length < offset + 1) { throw new PartialReadError() }
  const isPresent = buffer.readUInt8(offset++) !== 0
  if (isPresent) {
    const retval = this.read(buffer, offset, typeArgs, context)
    retval.size++
    return retval
  }
  return { size: 1 }
}

function writeOption (value, buffer, offset, typeArgs, context) {
  const isPresent = value != null
  buffer.writeUInt8(isPresent & 1, offset++)
  if (isPresent) {
    offset = this.write(value, buffer, offset, typeArgs, context)
  }
  return offset
}

function sizeOfOption (value, typeArgs, context) {
  return (value != null && this.sizeOf(value, typeArgs, context)) + 1
}

module.exports = {
  'switch': [readSwitch, writeSwitch, sizeOfSwitch, schema['switch']],
  'option': [readOption, writeOption, sizeOfOption, schema['option']]
}
