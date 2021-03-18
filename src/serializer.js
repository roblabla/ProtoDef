const Transform = require('readable-stream').Transform

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
    let buf
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
      let packet
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
  constructor (proto, mainType, noErrorLogging = false) {
    super({ readableObjectMode: true })
    this.proto = proto
    this.mainType = mainType
    this.noErrorLogging = noErrorLogging
  }

  parsePacketBuffer (buffer) {
    return this.proto.parsePacketBuffer(this.mainType, buffer)
  }

  _transform (chunk, enc, cb) {
    let packet
    try {
      packet = this.parsePacketBuffer(chunk)
      if (packet.metadata.size !== chunk.length && !this.noErrorLogging) {
        console.log('Chunk size is ' + chunk.length + ' but only ' + packet.metadata.size + ' was read ; partial packet : ' +
          JSON.stringify(packet.data) + '; buffer :' + chunk.toString('hex'))
      }
    } catch (e) {
      if (e.partialReadError) {
        if (!this.noErrorLogging) {
          console.log(e.stack)
        }
        return cb()
      } else {
        return cb(e)
      }
    }
    this.push(packet)
    cb()
  }
}

function recursiveGet (target, path, receiver) {
  return path.reduce((object, key) => Reflect.get(object, key, receiver), target)
}

class LazyPacketParser extends Transform {
  constructor (proto, mainType, shallowType, noErrorLogging = false) {
    super({ readableObjectMode: true })
    this.proto = proto
    this.mainType = mainType
    this.shallowType = shallowType
    this.noErrorLogging = noErrorLogging
  }

  makeProxyHandler (packetContext) {
    return {
      get: this.proxyGetter.bind(packetContext)
    }
  }

  proxyGetter (target, key, receiver) {
    if (key === '_isProxy') return true
    if (this.fullPacketData !== null) {
      return Reflect.get(recursiveGet(this.fullPacketData, this.path, receiver), key, receiver)
    }
    if (!(key in target)) {
      this.fullPacketData = this.parser.proto.parsePacketBuffer(this.parser.mainType, this.buffer).data
      return Reflect.get(recursiveGet(this.fullPacketData, this.path, receiver), key, receiver)
    }

    let prop = Reflect.get(...arguments)
    if (typeof prop === 'object' && !prop._isProxy) {
      prop = new Proxy(prop, this.parser.makeProxyHandler({
        ...this,
        path: [...this.path, key]
      }))
      Reflect.set(target, key, prop, receiver)
    }
    return prop
  }

  parsePacketBuffer (buffer) {
    let shallowPacketData
    try {
      shallowPacketData = this.proto.parsePacketBuffer(this.shallowType, buffer).data
    } catch (e) {
      return this.proto.parsePacketBuffer(this.mainType, buffer)
    }

    const packetContext = {
      shallowPacketData,
      buffer,
      fullPacketData: null,
      parser: this,
      path: []
    }

    let packet = {
      data: new Proxy(shallowPacketData, this.makeProxyHandler(packetContext)),
      metadata: { size: buffer.length },
      buffer
    }

    return packet
  }

  _transform (chunk, enc, cb) {
    let packet
    try {
      packet = this.parsePacketBuffer(chunk)
      if (packet.metadata.size !== chunk.length && !this.noErrorLogging) {
        console.log('Chunk size is ' + chunk.length + ' but only ' + packet.metadata.size + ' was read ; partial packet : ' +
          JSON.stringify(packet.data) + '; buffer :' + chunk.toString('hex'))
      }
    } catch (e) {
      if (e.partialReadError) {
        if (!this.noErrorLogging) {
          console.log(e.stack)
        }
        return cb()
      } else {
        return cb(e)
      }
    }
    this.push(packet)
    cb()
  }
}

module.exports = {
  Serializer: Serializer,
  Parser: Parser,
  FullPacketParser: FullPacketParser,
  LazyPacketParser: LazyPacketParser
}
