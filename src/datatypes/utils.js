var assert = require('assert');

var { getField, tryDoc } = require("../utils");

module.exports = {
  'varint': [readVarInt, writeVarInt],
  'bool': [readBool, writeBool],
  'pstring': [readPString, writePString],
  'buffer': [readBuffer, writeBuffer],
  'void': [readVoid, writeVoid],
  'bitfield': [readBitField, writeBitField],
  'cstring': [readCString, writeCString],
  'mapper':[readMapper,writeMapper]
};

function readMapper(read,{type,mappings},rootNode)
{
  return this.read(read, type, rootNode)
  .then(value => {
    var mappedValue=mappings[value];
    if(mappedValue==undefined) throw new Error(value+" is not in the mappings value");
    return mappedValue;
  })
}

function writeMapper(value,write,{type,mappings},rootNode)
{
  var keys=Object.keys(mappings);
  var mappedValue=null;
  for(var i=0;i<keys.length;i++) {
    if(mappings[keys[i]]==value) {
      mappedValue = keys[i];
      break;
    }
  }
  if(mappedValue==null) throw new Error(value+" is not in the mappings value");
  return this.write(mappedValue,write,type,rootNode);
}

function readVarInt(read) {
  var result = 0;
  var shift = 0;

  function next() {
     return read(1)
      .then(({buffer,offset}) => buffer.readUInt8(offset))
      .then(b => {
        result |= ((b & 0x7f) << shift); // Add the bits to our number, except MSB
        if (!(b & 0x80)) { // If the MSB is not set, we return the number
          return result;
        }
        shift += 7; // we only have 7 bits, MSB being the return-trigger
        assert.ok(shift < 64, "varint is too big"); // Make sure our shift don't overflow.
        return null;
      })
      .then(result => result!=null ? result : next());
  }
  return next();
}

function writeVarInt(value, write) {
  while(value & ~0x7F) {
    var buffer=new Buffer(1);
    buffer.writeUInt8((value & 0xFF) | 0x80,0);
    write(buffer);
    value >>>= 7;
  }
  var buffer2=new Buffer(1);
  buffer2.writeUInt8(value,0);
  write(buffer2);
}

function readPString(read, {countType,countTypeArgs},rootNode) {
  return tryDoc(() => this.read(read, { type: countType, typeArgs: countTypeArgs }, rootNode),"$count")
  .then(read)
  .then(buffer => buffer.toString('utf8', 0, size));
}

function writePString(value, write, {countType,countTypeArgs},rootNode) {
  var length = Buffer.byteLength(value, 'utf8');
  tryDoc(() => this.write(length, write, { type: countType, typeArgs: countTypeArgs }, rootNode),"$count");
  var buffer2=new Buffer(length);
  buffer2.write(value, 0, length, 'utf8');
  write(buffer2);
}

function readBool(read) {
  return read(1).then(({buffer,offset}) => !!buffer.readInt8(offset));
}

function writeBool(value, write) {
  var buffer=new Buffer(1);
  buffer.writeInt8(+value, 0);
  write(buffer);
}

function readBuffer(read, {count,countType,countTypeArgs}, rootNode) {
  var p;

  if (typeof count !== "undefined")
    p = Promise.resolve(getField(count, rootNode));
  else if (typeof countType !== "undefined")
    p = this.read(read, { type: countType, typeArgs: countTypeArgs }, rootNode);

  return p.then(read).then(({buffer}) => buffer);
}

function writeBuffer(value, write, {count,countType,countTypeArgs}, rootNode) {
  if (typeof count === "undefined" && typeof countType !== "undefined") {
    this.write(value.length, write, { type: countType, typeArgs: countTypeArgs }, rootNode);
  } else if (typeof count === "undefined") { // Broken schema, should probably error out
  }
  var buffer=new Buffer(value.length);
  value.copy(buffer, 0);
  write(buffer);
}

function readVoid() {
  return Promise.resolve(undefined);
}

function writeVoid(write) {
}

function generateBitMask(n) {
  return (1 << n) - 1;
}

function readBitField(read, typeArgs) {

  function compute({currentSize,val,curVal,bits}) {
    if(currentSize <= 0)
      return Promise.resolve({currentSize,val,curVal,bits});

    var p2=Promise.resolve(curVal);
    if (bits == 0) {
      bits = 8;
      p2=read(1).then(({buffer,offset}) => buffer[offset]);
    }
    return p2.then(curVal => {
        var bitsToRead = Math.min(currentSize, bits);
        val = (val << bitsToRead) | (curVal & generateBitMask(bits)) >> (bits - bitsToRead);
        bits -= bitsToRead;
        currentSize -= bitsToRead;
        return {currentSize,val,curVal,bits};
      })
      .then(compute)
  }

  return typeArgs.reduce((acc_, {size,signed,name}) =>
      acc_.then(({values,curVal,bits}) => {
        return compute({currentSize:size,val:0,curVal,bits})
          .then(({val,curVal,bits}) => {
            if (signed && val >= 1 << (size - 1))
              val -= 1 << size;
            values[name] = val;
            return {values,curVal,bits};
          })
      }),
    Promise.resolve({values:{},curVal:null,bits:0}))
    .then(({values}) => values);
}
function writeBitField(value, write, typeArgs) {
  var size=Math.ceil(typeArgs.reduce((acc, {size}) => acc + size, 0) / 8);
  var offset=0;
  var buffer=new Buffer(size);
  var toWrite = 0;
  var bits = 0;
  typeArgs.forEach(function({size,signed,name}) {
    var val = value[name];
    if ((!signed && val < 0) || (signed && val < -(1 << (size - 1))))
      throw new Error(value + " < " + signed ? (-(1 << (size - 1))) : 0);
    else if ((!signed && val >= 1 << size)
        || (signed && val >= (1 << (size - 1)) - 1))
      throw new Error(value + " >= " + signed ? (1 << size) : ((1 << (size - 1)) - 1));
    while (size > 0) {
      var writeBits = Math.min(8 - bits, size);
      toWrite = toWrite << writeBits |
        ((val >> (size - writeBits)) & generateBitMask(writeBits));
      size -= writeBits;
      bits += writeBits;
      if (bits === 8) {
        buffer[offset++] = toWrite;
        bits = 0;
        toWrite = 0;
      }
    }
  });
  if (bits != 0)
    buffer[offset++] = toWrite << (8 - bits);
  write(buffer);
}

function readCString(read) {
  return (str => read(1).then(({buffer,offset}) => buffer[offset]==0x00 ? Promise.resolve(str) : f(str+buffer[offset])))("");
}

function writeCString(value, write) {
  var buffer=new Buffer(value.length+1);
  var offset=0;
  buffer.write(value, offset);
  offset += value.length;
  buffer.writeInt8(0x00, offset);
  write(buffer);
}
