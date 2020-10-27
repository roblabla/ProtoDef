const { getCount, sendCount, calcCount, PartialReadError } = require('../../utils')
const schema = require('../../../ProtoDef/schemas/utils.json')

function readMapper (buffer, offset, { type, mappings }, rootNode) {
  const { size, value } = this.read(buffer, offset, type, rootNode)
  for (const key in mappings) {
    if (key === value || +key === +value) {
      return { value: mappings[key], size }
    }
  }
  throw new Error(`${typeof value} "${value}" is not in the mappings value`)
}

function writeMapper (value, buffer, offset, { type, mappings }, rootNode) {
  for (const key in mappings) {
    const writeValue = mappings[key]
    if (writeValue === value || +writeValue === +value) {
      return this.write(key, buffer, offset, type, rootNode)
    }
  }
  throw new Error(`${value} is not in the mappings value`)
}

function sizeOfMapper (value, { type, mappings }, rootNode) {
  for (const key in mappings) {
    const sizeValue = mappings[key]
    if (sizeValue === value || +sizeValue === +value) {
      return this.sizeOf(key, type, rootNode)
    }
  }
  throw new Error(`${value} is not in the mappings value`)
}

function readPString (buffer, offset, typeArgs, rootNode) {
  const { size, count } = getCount.call(this, buffer, offset, typeArgs, rootNode)
  const cursor = offset + size
  const strEnd = cursor + count
  if (strEnd > buffer.length) {
    throw new PartialReadError('Missing characters in string, found size is ' +
    buffer.length + ' expected size was ' + strEnd)
  }
  return {
    value: buffer.toString('utf8', cursor, strEnd),
    size: size + count
  }
}

function writePString (value, buffer, offset, typeArgs, rootNode) {
  const length = Buffer.byteLength(value, 'utf8')
  offset = sendCount.call(this, length, buffer, offset, typeArgs, rootNode)
  buffer.write(value, offset, length, 'utf8')
  return offset + length
}

function sizeOfPString (value, typeArgs, rootNode) {
  const length = Buffer.byteLength(value, 'utf8')
  const size = calcCount.call(this, length, typeArgs, rootNode)
  return size + length
}

function readBuffer (buffer, offset, typeArgs, rootNode) {
  const { size, count } = getCount.call(this, buffer, offset, typeArgs, rootNode)
  offset += size
  if (offset + count > buffer.length) throw new PartialReadError()
  return {
    value: buffer.slice(offset, offset + count),
    size: size + count
  }
}

function writeBuffer (value, buffer, offset, typeArgs, rootNode) {
  offset = sendCount.call(this, value.length, buffer, offset, typeArgs, rootNode)
  return offset + value.copy(buffer, offset)
}

function sizeOfBuffer (value, typeArgs, rootNode) {
  return calcCount.call(this, value.length, typeArgs, rootNode) + value.length
}

function generateBitMask (n) {
  return (1 << n) - 1
}

function readBitField (buffer, offset, typeArgs) {
  const value = {}
  const beginOffset = offset
  let curVal = null
  let bits = 0
  for (const { size, signed, name } of typeArgs) {
    let currentSize = size
    let val = 0
    while (currentSize > 0) {
      if (bits === 0) {
        if (buffer.length < offset + 1) { throw new PartialReadError() }
        curVal = buffer[offset++]
        bits = 8
      }
      const bitsToRead = Math.min(currentSize, bits)
      val = (val << bitsToRead) | (curVal & generateBitMask(bits)) >> (bits - bitsToRead)
      bits -= bitsToRead
      currentSize -= bitsToRead
    }
    if (signed && val >= 1 << (size - 1)) { val -= 1 << size }
    value[name] = val
  }
  return {
    value,
    size: offset - beginOffset
  }
}

function writeBitField (value, buffer, offset, typeArgs) {
  let toWrite = 0
  let bits = 0
  for (let { size, signed, name } of typeArgs) {
    const val = value[name]
    const min = +signed && -(1 << (size - 1))
    const max = (1 << (size - signed)) - signed
    if (value < min) { throw new Error(value + ' < ' + min) }
    if (val >= max) { throw new Error(value + ' >= ' + max) }
    while (size > 0) {
      const writeBits = Math.min(8 - bits, size)
      toWrite = toWrite << writeBits |
        ((val >> (size - writeBits)) & generateBitMask(writeBits))
      size -= writeBits
      bits += writeBits
      if (bits === 8) {
        buffer[offset++] = toWrite
        bits = 0
        toWrite = 0
      }
    }
  }
  if (bits !== 0) {
    buffer[offset++] = toWrite << (8 - bits)
  }
  return offset
}

function sizeOfBitField (value, typeArgs) {
  let i = 0
  for (const { size } of typeArgs) { i += size }
  return Math.ceil(i / 8)
}

module.exports = {
  'pstring': [readPString, writePString, sizeOfPString, schema['pstring']],
  'buffer': [readBuffer, writeBuffer, sizeOfBuffer, schema['buffer']],
  'bitfield': [readBitField, writeBitField, sizeOfBitField, schema['bitfield']],
  'mapper': [readMapper, writeMapper, sizeOfMapper, schema['mapper']]
}
