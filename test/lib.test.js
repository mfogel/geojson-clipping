/* eslint-env jest */

const fs = require('fs')
const path = require('path')
const process = require('process')
const stream = require('stream')
const lib = require('../src/lib')

jest.mock('../src/parse')
const parse = require('../src/parse')

jest.mock('polygon-clipping')
const polygonClipping = require('polygon-clipping')

afterEach(() => jest.clearAllMocks())

const tryFileRm = fn => {
  try {
    fs.unlinkSync(fn)
  } catch (err) {}
}

const tryDirRmf = dir => {
  try {
    fs.readdirSync(dir).forEach(fn => tryFileRm(path.join(dir, fn)))
    fs.rmdirSync(dir)
  } catch (err) {}
}

const createFeatureMultiPoly = coords => ({
  type: 'Feature',
  properties: null,
  geometry: {
    type: 'MultiPolygon',
    coordinates: coords
  }
})

describe('lib.getOutputStream', () => {
  const tmpOutput = 'test/tmp-out.geojson'
  afterAll(() => tryFileRm(tmpOutput))

  test('output set', () => {
    const opts = {
      output: tmpOutput,
      stdout: process.stdout
    }
    const outStream = lib.getOutputStream(opts)

    expect(outStream.writable).toBe(true)
    expect(outStream.bytesWritten).toBe(0)
    expect(outStream.path).toEqual(opts.output)
  })

  test('output not set, fall to default', () => {
    const opts = {
      output: null,
      stdout: process.stdout
    }
    const outStream = lib.getOutputStream(opts)

    expect(outStream).toBe(process.stdout)
  })
})

describe('lib.getReadStreamsFromDir', () => {
  const tmpDir = 'test/tmp'
  afterEach(() => tryDirRmf(tmpDir))

  test('empty dir', () => {
    fs.mkdirSync(tmpDir)
    const streams = lib.getReadStreamsFromDir(tmpDir)

    expect(streams).toEqual([])
  })

  test('non geojson files ignored', () => {
    const geojsonFile1 = path.join(tmpDir, 'f1.geojson')
    const geojsonFile2 = path.join(tmpDir, 'f2.geojson')
    const nonGeojsonFile = path.join(tmpDir, 'f3.notgeojson')
    fs.mkdirSync(tmpDir)
    fs.openSync(geojsonFile1, 'w')
    fs.openSync(geojsonFile2, 'w')
    fs.openSync(nonGeojsonFile, 'w')
    const streams = lib.getReadStreamsFromDir(tmpDir)

    expect(streams.length).toBe(2)
    expect(streams[0].readable).toBe(true)
    expect(streams[1].readable).toBe(true)
    expect(streams[0].bytesRead).toBe(0)
    expect(streams[1].bytesRead).toBe(0)
    expect(streams[0].path).toBe(geojsonFile1)
    expect(streams[1].path).toBe(geojsonFile2)
  })
})

describe('lib.getInputStreams', () => {
  const tmpDir = 'test/tmp'
  const tmpSubject = 'test/tmp-subject.geojson'
  const tmpFile1 = 'test/tmp-file1.geojson'
  const tmpFile2 = 'test/tmp-file2.geojson'
  afterEach(() => {
    tryDirRmf(tmpDir)
    tryFileRm(tmpSubject)
    tryFileRm(tmpFile1)
    tryFileRm(tmpFile2)
  })

  test('stdin from terminal ignored', () => {
    const opts = { stdin: process.stdin }
    const streams = lib.getInputStreams([], opts)

    expect(streams).toEqual([])
  })

  test('just stdin', () => {
    const opts = { stdin: new stream.Readable() }
    const streams = lib.getInputStreams([], opts)

    expect(streams.length).toBe(1)
    expect(streams[0]).toBe(opts.stdin)
  })

  test('stdin and subject', () => {
    fs.openSync(tmpSubject, 'w')
    const opts = { subject: tmpSubject, stdin: new stream.Readable() }
    const streams = lib.getInputStreams([], opts)

    expect(streams.length).toBe(2)
    expect(streams[0].readable).toBe(true)
    expect(streams[0].bytesRead).toBe(0)
    expect(streams[0].path).toBe(tmpSubject)
    expect(streams[1]).toBe(opts.stdin)
  })

  test('stdin and some positionals', () => {
    fs.openSync(tmpFile1, 'w')
    fs.openSync(tmpFile2, 'w')
    const opts = { stdin: new stream.Readable() }
    const streams = lib.getInputStreams([tmpFile1, tmpFile2], opts)

    expect(streams.length).toBe(3)
    expect(streams[0]).toBe(opts.stdin)
    expect(streams[1].readable).toBe(true)
    expect(streams[2].readable).toBe(true)
    expect(streams[1].bytesRead).toBe(0)
    expect(streams[2].bytesRead).toBe(0)
    expect(streams[1].path).toBe(tmpFile1)
    expect(streams[2].path).toBe(tmpFile2)
  })

  test('stdin and a directory positional', () => {
    const geojsonFile = path.join(tmpDir, 'file.geojson')
    fs.mkdirSync(tmpDir)
    fs.openSync(geojsonFile, 'w')
    const opts = { stdin: new stream.Readable() }
    const streams = lib.getInputStreams([tmpDir], opts)

    expect(streams.length).toBe(2)
    expect(streams[0]).toBe(opts.stdin)
    expect(streams[1].readable).toBe(true)
    expect(streams[1].bytesRead).toBe(0)
    expect(streams[1].path).toBe(geojsonFile)
  })
})

describe('lib.writeMultiPolyToStream', () => {
  const tmpOutput = 'test/tmp-out.geojson'
  afterEach(() => tryFileRm(tmpOutput))

  test('empty multipoly', () => {
    const multipoly = []
    const expected = createFeatureMultiPoly(multipoly)
    let outString = ''
    const outStream = new stream.Writable({
      write: (chunk, encoding, callback) => {
        outString += chunk
        callback()
      }
    })

    expect.assertions(1)
    return lib.writeMultiPolyToStream(outStream, multipoly).then(() => {
      const outjson = JSON.parse(outString)
      expect(outjson).toEqual(expected)
    })
  })

  test('basic one-poly multiploy', () => {
    const multipoly = [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]]
    const expected = createFeatureMultiPoly(multipoly)
    const outStream = fs.createWriteStream(tmpOutput)

    expect.assertions(1)
    return lib.writeMultiPolyToStream(outStream, multipoly).then(result => {
      const outString = fs.readFileSync(tmpOutput, 'utf8')
      expect(outString).toEqual(JSON.stringify(expected))
    })
  })
})

describe('lib.getMultiPolysFromStream', () => {
  const warn = () => {}

  test('empty stream', () => {
    const readStream = new stream.Readable()
    readStream.push(null)

    expect.assertions(1)
    return lib
      .getMultiPolysFromStream(readStream, warn)
      .then(mps => expect(mps).toEqual([]))
  })

  test('non-whitespace & non-json at start of stream rejects', () => {
    const readStream = new stream.Readable()
    readStream.push('this isnt json')
    readStream.push(null)

    expect.assertions(1)
    return lib
      .getMultiPolysFromStream(readStream, warn)
      .catch(() => expect(true).toBe(true))
  })

  test('unparsable json rejects', () => {
    const readStream = new stream.Readable()
    readStream.push('{no bueno}')
    readStream.push(null)

    expect.assertions(1)
    return lib
      .getMultiPolysFromStream(readStream, warn)
      .catch(() => expect(true).toBe(true))
  })

  test('error in parse rejects', () => {
    parse.mockImplementationOnce(() => {
      throw new Error()
    })
    const readStream = new stream.Readable()
    readStream.push('{}')
    readStream.push(null)

    expect.assertions(1)
    return lib
      .getMultiPolysFromStream(readStream, warn)
      .catch(() => expect(true).toBe(true))
  })

  test('return value of parse resolves', () => {
    parse.mockImplementation(() => 42)
    const readStream = new stream.Readable()
    readStream.push('{}{}')
    readStream.push(null)

    expect.assertions(1)
    return lib
      .getMultiPolysFromStream(readStream, warn)
      .then(val => expect(val).toEqual([42, 42]))
  })

  test('basic json object passed to parser correctly', () => {
    const obj = { a: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj))
    readStream.push(null)

    expect.assertions(2)
    return lib.getMultiPolysFromStream(readStream, warn).then(() => {
      expect(parse).toHaveBeenCalledTimes(1)
      expect(parse).toHaveBeenCalledWith(obj)
    })
  })

  test('complicated json object sent to parser correctly', () => {
    const obj = {
      a: {
        b: {},
        c: [45]
      },
      d: 42,
      e: {
        f: {
          g: 5
        }
      }
    }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj))
    readStream.push(null)

    expect.assertions(2)
    return lib.getMultiPolysFromStream(readStream, warn).then(() => {
      expect(parse).toHaveBeenCalledTimes(1)
      expect(parse).toHaveBeenCalledWith(obj)
    })
  })

  test('json object with trailing and leading whitespace', () => {
    const obj = { a: 42 }
    const readStream = new stream.Readable()
    readStream.push(' \n\t\r ')
    readStream.push(JSON.stringify(obj))
    readStream.push(' \n\t\r ')
    readStream.push(null)

    expect.assertions(2)
    return lib.getMultiPolysFromStream(readStream, warn).then(() => {
      expect(parse).toHaveBeenCalledTimes(1)
      expect(parse).toHaveBeenCalledWith(obj)
    })
  })

  test('json object with leading crud', () => {
    const obj = { a: 42 }
    const readStream = new stream.Readable()
    readStream.push('garbage')
    readStream.push(JSON.stringify(obj))
    readStream.push(null)

    expect.assertions(1)
    return lib
      .getMultiPolysFromStream(readStream, warn)
      .catch(() => expect(true).toBe(true))
  })

  test('json object with trailing crud', () => {
    const obj = { a: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj))
    readStream.push('garbage')
    readStream.push(null)

    expect.assertions(1)
    return lib
      .getMultiPolysFromStream(readStream, warn)
      .catch(() => expect(true).toBe(true))
  })

  test('two json objects no separation', () => {
    const obj1 = { a: 42 }
    const obj2 = { b: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj1))
    readStream.push(JSON.stringify(obj2))
    readStream.push(null)

    expect.assertions(3)
    return lib.getMultiPolysFromStream(readStream, warn).then(() => {
      expect(parse).toHaveBeenCalledTimes(2)
      expect(parse).toHaveBeenCalledWith(obj1)
      expect(parse).toHaveBeenCalledWith(obj2)
    })
  })

  test('two json objects whitespace separation', () => {
    const obj1 = { a: 42 }
    const obj2 = { b: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj1))
    readStream.push('  \n\r \t')
    readStream.push(JSON.stringify(obj2))
    readStream.push(null)

    expect.assertions(3)
    return lib.getMultiPolysFromStream(readStream, warn).then(() => {
      expect(parse).toHaveBeenCalledTimes(2)
      expect(parse).toHaveBeenCalledWith(obj1)
      expect(parse).toHaveBeenCalledWith(obj2)
    })
  })

  test('two json objects non-whitespace separation rejects', () => {
    const obj1 = { a: 42 }
    const obj2 = { b: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj1))
    readStream.push('dakfjskdf')
    readStream.push(JSON.stringify(obj2))
    readStream.push(null)

    expect.assertions(1)
    return lib
      .getMultiPolysFromStream(readStream, warn)
      .catch(() => expect(true).toBe(true))
  })

  test('three json objects', () => {
    const obj1 = { a: 42 }
    const obj2 = { b: 42 }
    const obj3 = { c: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj1))
    readStream.push(JSON.stringify(obj2))
    readStream.push(JSON.stringify(obj3))
    readStream.push(null)

    expect.assertions(4)
    return lib.getMultiPolysFromStream(readStream, warn).then(() => {
      expect(parse).toHaveBeenCalledTimes(3)
      expect(parse).toHaveBeenCalledWith(obj1)
      expect(parse).toHaveBeenCalledWith(obj2)
      expect(parse).toHaveBeenCalledWith(obj3)
    })
  })
})

describe('lib.doIt', () => {
  const tmpOutput = 'test/tmp-out.geojson'
  const tmpFile1 = 'test/tmp-file1.geojson'
  const tmpFile2 = 'test/tmp-file2.geojson'
  const tmpSubject = 'test/tmp-subject.geojson'
  const tmpDir = 'test/tmp'
  afterEach(() => {
    tryFileRm(tmpOutput)
    tryFileRm(tmpFile1)
    tryFileRm(tmpFile2)
    tryFileRm(tmpSubject)
    tryDirRmf(tmpDir)
  })

  test('empty operation', () => {
    polygonClipping.union.mockImplementation(() => [])
    const operation = 'union'
    const positionals = []
    const expected = createFeatureMultiPoly([])
    let outString = ''
    const opts = {
      stdin: new stream.Readable(),
      stdout: new stream.Writable({
        write: (chunk, encoding, callback) => {
          outString += chunk
          callback()
        }
      })
    }
    opts.stdin.push(null)

    expect.assertions(3)
    return lib.doIt(operation, positionals, opts).then(result => {
      expect(polygonClipping.union).toHaveBeenCalledTimes(1)
      expect(polygonClipping.union).toHaveBeenCalledWith()
      expect(outString).toEqual(JSON.stringify(expected))
    })
  })

  test('polygon clipping output written out to output', () => {
    const coords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const expected = createFeatureMultiPoly(coords)
    polygonClipping.union.mockImplementation(() => coords)
    const operation = 'union'
    const positionals = []
    const opts = {
      stdin: new stream.Readable(),
      output: tmpOutput
    }
    opts.stdin.push(null)

    expect.assertions(1)
    return lib.doIt(operation, positionals, opts).then(result => {
      const outString = fs.readFileSync(tmpOutput, 'utf8')
      expect(outString).toEqual(JSON.stringify(expected))
    })
  })

  test('stdin and file positionals fed correctly to polygon clipping', () => {
    const realParse = require.requireActual('../src/parse')
    parse.mockImplementation(realParse)
    polygonClipping.union.mockImplementation(() => [])

    const stdinGeojson1 = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]]
    }

    const stdinGeojson2 = {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [2, 0], [0, 2], [0, 0]]]]
    }

    const file1Geojson1 = {
      type: 'Polygon',
      coordinates: [[[0, 0], [3, 0], [0, 3], [0, 0]]]
    }

    const file1Geojson2 = {
      type: 'Polygon',
      coordinates: [[[0, 0], [4, 0], [0, 4], [0, 0]]]
    }

    const file2Geojson = {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [5, 0], [0, 5], [0, 0]]]]
    }

    fs.writeFileSync(
      tmpFile1,
      JSON.stringify(file1Geojson1) + JSON.stringify(file1Geojson2)
    )
    fs.writeFileSync(tmpFile2, JSON.stringify(file2Geojson))

    const operation = 'union'
    const positionals = [tmpFile1, tmpFile2]
    const opts = {
      stdin: new stream.Readable(),
      stdout: new stream.Writable({
        write: (chunk, encoding, callback) => callback()
      })
    }
    opts.stdin.push(JSON.stringify(stdinGeojson1))
    opts.stdin.push(JSON.stringify(stdinGeojson2))
    opts.stdin.push(null)

    expect.assertions(2)
    return lib.doIt(operation, positionals, opts).then(result => {
      expect(polygonClipping.union).toHaveBeenCalledTimes(1)
      expect(polygonClipping.union).toHaveBeenCalledWith(
        [stdinGeojson1.coordinates],
        stdinGeojson2.coordinates,
        [file1Geojson1.coordinates],
        [file1Geojson2.coordinates],
        file2Geojson.coordinates
      )
    })
  })

  test('stdin, subject and dir positionals fed correctly to polygon clipping', () => {
    const realParse = require.requireActual('../src/parse')
    parse.mockImplementation(realParse)
    polygonClipping.difference.mockImplementation(() => [])
    const tmpFile = path.join(tmpDir, 'file.geojson')

    const subjectGeojson1 = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]]
    }

    const subjectGeojson2 = {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [2, 0], [0, 2], [0, 0]]]]
    }

    const stdinGeojson = {
      type: 'Polygon',
      coordinates: [[[0, 0], [3, 0], [0, 3], [0, 0]]]
    }

    const fileGeojson = {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [5, 0], [0, 5], [0, 0]]]]
    }

    fs.mkdirSync(tmpDir)
    fs.writeFileSync(tmpFile, JSON.stringify(fileGeojson))
    fs.writeFileSync(
      tmpSubject,
      JSON.stringify(subjectGeojson1) + '\n' + JSON.stringify(subjectGeojson2)
    )

    const operation = 'difference'
    const positionals = [tmpDir]
    const opts = {
      stdin: new stream.Readable(),
      stdout: new stream.Writable({
        write: (chunk, encoding, callback) => callback()
      }),
      subject: tmpSubject
    }
    opts.stdin.push(JSON.stringify(stdinGeojson))
    opts.stdin.push(null)

    expect.assertions(2)
    return lib.doIt(operation, positionals, opts).then(result => {
      expect(polygonClipping.difference).toHaveBeenCalledTimes(1)
      expect(polygonClipping.difference).toHaveBeenCalledWith(
        [subjectGeojson1.coordinates],
        subjectGeojson2.coordinates,
        [stdinGeojson.coordinates],
        fileGeojson.coordinates
      )
    })
  })
})
