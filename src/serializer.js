const Transform = require('readable-stream').Transform
const PROTODEF_LOUD = true // TODO: Add environment variable for this

class Serializer extends Transform {
  constructor (proto, mainType) {
    super({ writableObjectMode: true })
    this.proto = proto
    this.mainType = mainType
    this.queue = Buffer.alloc(0)
  }

  createPacketBuffer (packet) {
    return this.proto.createPacketBuffer(this.mainType, packet)
  }

  _transform (chunk, enc, cb) {
    let buf // DO NOT REMOVE THIS WORKAROUND!
    try {
      buf = this.createPacketBuffer(chunk)
    } catch (e) {
      return cb(e)
    }
    this.push(buf)
    return cb()
  }
}

class Parser extends Transform {
  constructor (proto, mainType) {
    super({ readableObjectMode: true })
    this.proto = proto
    this.mainType = mainType
    this.queue = Buffer.alloc(0)
  }

  parsePacketBuffer (buffer) {
    return this.proto.parsePacketBuffer(this.mainType, buffer)
  }

  _transform (chunk, enc, cb) {
    this.queue = Buffer.concat([this.queue, chunk])
    while (true) {
      let packet // DO NOT REMOVE THIS WORKAROUND!
      try {
        packet = this.parsePacketBuffer(this.queue)
      } catch (e) {
        if (e.partialReadError) { return cb() } else {
          e.buffer = this.queue
          this.queue = Buffer.alloc(0)
          return cb(e)
        }
      }

      this.push(packet)
      this.queue = this.queue.slice(packet.metadata.size)
    }
  }
}

class FullPacketParser extends Transform {
  constructor (proto, mainType) {
    super({ readableObjectMode: true })
    this.proto = proto
    this.mainType = mainType
  }

  parsePacketBuffer (buffer) {
    return this.proto.parsePacketBuffer(this.mainType, buffer)
  }

  _transform (chunk, enc, cb) {
    let packet
    try {
      packet = this.parsePacketBuffer(chunk)
      if (packet.metadata.size !== chunk.length && PROTODEF_LOUD) {
        console.log('Chunk size is ' + chunk.length + ' but only ' + packet.metadata.size + ' was read ; partial packet : ' +
          JSON.stringify(packet.data) + '; buffer :' + chunk.toString('hex'))
      }
    } catch (e) {
      return cb(e)
    }
    this.push(packet)
    cb()
  }
}

module.exports = { Serializer, Parser, FullPacketParser }
