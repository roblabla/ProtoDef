const { getField, getCount, sendCount, calcCount, tryDoc } = require('../../utils')
const schema = require('../../../ProtoDef/schemas/structures.json')

function readArray (buffer, offset, typeArgs, rootNode) {
  const value = []
  let { count, size } = getCount.call(this, buffer, offset, typeArgs, rootNode)
  offset += size
  for (let i = 0; i < count; i++) {
    const { size: s, value: v } = tryDoc(() => this.read(buffer, offset, typeArgs.type, rootNode), i)
    size += s
    offset += s
    value.push(v)
  }
  return { value, size }
}

function writeArray (value, buffer, offset, typeArgs, rootNode) {
  offset = sendCount.call(this, value.length, buffer, offset, typeArgs, rootNode)
  for (let i = 0, l = value.length; i < l; i++) {
    offset = tryDoc(() => this.write(value[i], buffer, offset, typeArgs.type, rootNode), i)
  }
  return offset
}

function sizeOfArray (value, typeArgs, rootNode) {
  let size = calcCount.call(this, value.length, typeArgs, rootNode)
  for (let i = 0, l = value.length; i < l; i++) {
    size += tryDoc(() => this.sizeOf(value[i], typeArgs.type, rootNode), i)
  }
  return size
}

function readCount (buffer, offset, { type }, rootNode) {
  return this.read(buffer, offset, type, rootNode)
}

function writeCount (value, buffer, offset, { countFor, type }, rootNode) {
  // Actually gets the required field, and writes its length. Value is unused.
  // TODO : a bit hackityhack.
  return this.write(getField(countFor, rootNode).length, buffer, offset, type, rootNode)
}

function sizeOfCount (value, { countFor, type }, rootNode) {
  // TODO : should I use value or getField().length ?
  return this.sizeOf(getField(countFor, rootNode).length, type, rootNode)
}

function readContainer (buffer, offset, typeArgs, context) {
  const value = {}
  let size = 0
  Object.defineProperty(value, '..', {
    enumerable: false,
    configurable: true,
    value: context
  })
  for (const { type, name, anon } of typeArgs) {
    tryDoc(() => {
      const { size: s, value: v } = this.read(buffer, offset, type, value)
      size += s
      offset += s
      if (anon && v !== undefined) {
        for (const k in v) {
          value[k] = v[k]
        }
        return
      }
      value[name] = v
    }, name || 'unknown')
  }
  context = undefined
  return { value, size }
}

function writeContainer (value, buffer, offset, typeArgs, context) {
  Object.defineProperty(value, '..', {
    enumerable: false,
    configurable: true,
    value: context
  })
  for (const { type, name, anon } of typeArgs) {
    offset = tryDoc(() => this.write(anon ? value : value[name], buffer, offset, type, value), name || 'unknown')
  }
  return offset
}

function sizeOfContainer (value, typeArgs, context) {
  Object.defineProperty(value, '..', {
    enumerable: false,
    configurable: true,
    value: context
  })
  let size = 0
  for (const { type, name, anon } of typeArgs) {
    size += tryDoc(() => this.sizeOf(anon ? value : value[name], type, value), name || 'unknown')
  }
  return size
}

module.exports = {
  'array': [readArray, writeArray, sizeOfArray, schema['array']],
  'count': [readCount, writeCount, sizeOfCount, schema['count']],
  'container': [readContainer, writeContainer, sizeOfContainer, schema['container']]
}
