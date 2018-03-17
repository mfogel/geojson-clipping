/* eslint-env jest */

const path = require('path')
const process = require('process')
const rimraf = require('rimraf')
const stream = require('stream')
const lib = require('../src/lib')

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

jest.mock('../src/parse')
const parse = require('../src/parse')

jest.mock('polygon-clipping')
const polygonClipping = require('polygon-clipping')

afterEach(() => jest.clearAllMocks())

const tmpRoot = 'test/tmp-delete-me'
beforeAll(() => fs.mkdirAsync(tmpRoot))
afterAll(() => Promise.promisify(rimraf)(tmpRoot))

const setUpFs = async (dirs, files) => {
  await Promise.all(dirs.map(dir => fs.mkdirAsync(dir)))
  await Promise.all(
    files.map(fn => fs.openAsync(fn, 'w').then(fd => fs.closeAsync(fd)))
  )
}

const tearDownFs = async (dirs, files) => {
  await Promise.all(files.map(fn => fs.unlinkAsync(fn)))
  await Promise.all(dirs.map(dir => fs.rmdirAsync(dir)))
}

const createMultiPoly = coords => ({
  type: 'MultiPolygon',
  coordinates: coords
})

const createFeatureMultiPoly = coords => ({
  type: 'Feature',
  properties: null,
  geometry: createMultiPoly(coords)
})

describe('lib.getSubjectAndStdinStreams', () => {
  const tmpSubject = path.join(tmpRoot, 'subject.geojson')
  beforeAll(() => setUpFs([], [tmpSubject]))
  afterAll(() => tearDownFs([], [tmpSubject]))

  test('subject set, stdin piped', () => {
    const opts = {
      subject: tmpSubject,
      stdin: new stream.Readable()
    }
    const streams = lib.getSubjectAndStdinStreams(opts)

    expect(streams.length).toBe(2)
    expect(streams[0].path).toEqual(opts.subject)
    expect(streams[1]).toBe(opts.stdin)
  })

  test('subject not set, stdin piped', () => {
    const opts = {
      subject: null,
      stdin: new stream.Readable()
    }
    const streams = lib.getSubjectAndStdinStreams(opts)

    expect(streams.length).toBe(1)
    expect(streams[0]).toBe(opts.stdin)
  })

  test('subject set, stdin not piped', () => {
    const opts = {
      subject: tmpSubject,
      stdin: process.stdin
    }
    const streams = lib.getSubjectAndStdinStreams(opts)

    expect(streams.length).toBe(1)
    expect(streams[0].path).toEqual(opts.subject)
  })

  test('subject not set, stdin not piped', () => {
    const opts = {
      subject: null,
      stdin: process.stdin
    }
    const streams = lib.getSubjectAndStdinStreams(opts)

    expect(streams.length).toBe(0)
  })
})

describe('lib.getFilePaths', () => {
  const tmpDir = path.join(tmpRoot, 'dir')
  const tmpFile1 = path.join(tmpDir, 'file1.geojson')
  const tmpFile2 = path.join(tmpDir, 'file2.geojson')
  const tmpNotGeojson = path.join(tmpDir, 'file.notgeojson')
  const files = [tmpFile1, tmpFile2, tmpNotGeojson]
  beforeAll(() => setUpFs([tmpDir], files))
  afterAll(() => tearDownFs([tmpDir], files))

  test('file', async () => {
    const paths = await lib.getFilePaths(tmpFile1)
    expect(paths).toEqual([tmpFile1])
  })

  test('direcdtory scaned and ignores non-geojson', async () => {
    const paths = await lib.getFilePaths(tmpDir)
    expect(paths).toEqual([tmpFile1, tmpFile2])
  })
})

describe('lib.getInputMultiPolys', () => {
  const tmpDir = path.join(tmpRoot, 'dir')
  const tmpSubject = path.join(tmpRoot, 'subject.geojson')
  const tmpFile = path.join(tmpRoot, 'file.geojson')
  const tmpInDir1 = path.join(tmpDir, 'file1.[0,0,1,1].geojson')
  const tmpInDir2 = path.join(tmpDir, 'file2.geojson')
  const tmpNotGeojson = path.join(tmpDir, 'file.notgeojson')
  const files = [tmpSubject, tmpFile, tmpInDir1, tmpInDir2, tmpNotGeojson]
  beforeAll(() => setUpFs([tmpDir], files))
  afterAll(() => tearDownFs([tmpDir], files))

  test('no inputs', async () => {
    const positionals = []
    const opts = { stdin: process.stdin }
    const mps = await lib.getInputMultiPolys(positionals, opts)
    expect(mps).toEqual([])
  })

  test('stdin, subject, positional file & dir inputs', async () => {
    parse.mockImplementation(input => input)
    const stdinGeojson = { id: 1 }
    const subGeojson = { id: 2 }
    const inDir1Geojson = { id: 3 }
    const inDir2Geojson = { id: 4 }
    const fileGeojson = { id: 5 }
    const notGeojson = 'not geojson'

    await fs.writeFileAsync(tmpSubject, JSON.stringify(subGeojson))
    await fs.writeFileAsync(tmpInDir1, JSON.stringify(inDir1Geojson))
    await fs.writeFileAsync(tmpInDir2, JSON.stringify(inDir2Geojson))
    await fs.writeFileAsync(tmpNotGeojson, notGeojson)
    await fs.writeFileAsync(tmpFile, JSON.stringify(fileGeojson))

    const positionals = [tmpFile, tmpDir]
    const opts = {
      stdin: new stream.Readable(),
      subject: tmpSubject
    }

    opts.stdin.push(JSON.stringify(stdinGeojson))
    opts.stdin.push(null)

    const mps = await lib.getInputMultiPolys(positionals, opts)
    expect(mps).toEqual([
      subGeojson,
      stdinGeojson,
      fileGeojson,
      inDir1Geojson,
      inDir2Geojson
    ])
  })

  test('bbox filter no subject', async () => {
    const opts = {
      stdin: new stream.Readable(),
      bboxes: true
    }
    opts.stdin.push(null)

    const mps = await lib.getInputMultiPolys([], opts)
    expect(mps).toEqual([])
  })

  test('bbox subject from stdin filter removes some files', async () => {
    parse.mockImplementation(input => input)
    const stdinGeojson = [[[[2, 2], [3, 2], [2, 3], [2, 2]]]]
    const inDir1Geojson = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const inDir2Geojson = [[[[2, 2], [3, 2], [2, 3], [2, 2]]]]

    await fs.writeFileAsync(tmpInDir1, JSON.stringify(inDir1Geojson))
    await fs.writeFileAsync(tmpInDir2, JSON.stringify(inDir2Geojson))

    const positionals = [tmpDir]
    const opts = {
      stdin: new stream.Readable(),
      bboxes: true
    }

    opts.stdin.push(JSON.stringify(stdinGeojson))
    opts.stdin.push(null)

    const mps = await lib.getInputMultiPolys(positionals, opts)
    expect(mps).toEqual([stdinGeojson, inDir2Geojson])
  })

  test('bbox subject from file filter removes some multipolys', async () => {
    parse.mockImplementation(input => input)
    const subjectGeojson = [[[[4, 4], [5, 4], [4, 5], [4, 4]]]]
    const inDir1Geojson = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const inDir2Geojson = [[[[2, 2], [3, 2], [2, 3], [2, 2]]]]

    await fs.writeFileAsync(tmpSubject, JSON.stringify(subjectGeojson))
    await fs.writeFileAsync(tmpInDir1, JSON.stringify(inDir1Geojson))
    await fs.writeFileAsync(tmpInDir2, JSON.stringify(inDir2Geojson))

    const positionals = [tmpDir]
    const opts = {
      stdin: process.stdin,
      subject: tmpSubject,
      bboxes: true
    }

    const mps = await lib.getInputMultiPolys(positionals, opts)
    expect(mps).toEqual([subjectGeojson])
  })
})

describe('lib.getMultiPolysFromStream', () => {
  const warn = () => {}

  test('empty stream', async () => {
    const readStream = new stream.Readable()
    readStream.push(null)

    const mps = await lib.getMultiPolysFromStream(readStream, warn)
    expect(mps).toEqual([])
  })

  test('non-whitespace & non-json at start of stream rejects', () => {
    const readStream = new stream.Readable()
    readStream.push('this isnt json')
    readStream.push(null)

    const prom = lib.getMultiPolysFromStream(readStream, warn)
    return expect(prom).rejects.toBeDefined()
  })

  test('unparsable json rejects', () => {
    const readStream = new stream.Readable()
    readStream.push('{no bueno}')
    readStream.push(null)

    const prom = lib.getMultiPolysFromStream(readStream, warn)
    return expect(prom).rejects.toBeDefined()
  })

  test('error in parse rejects', () => {
    parse.mockImplementation(() => {
      throw new Error()
    })
    const readStream = new stream.Readable()
    readStream.push('{}')
    readStream.push(null)

    const prom = lib.getMultiPolysFromStream(readStream, warn)
    return expect(prom).rejects.toBeDefined()
  })

  test('return value of parse resolves', async () => {
    parse.mockImplementation(() => 42)
    const readStream = new stream.Readable()
    readStream.push('{}{}')
    readStream.push(null)

    const val = await lib.getMultiPolysFromStream(readStream, warn)
    expect(val).toEqual([42, 42])
  })

  test('basic json object passed to parser correctly', async () => {
    const obj = { a: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj))
    readStream.push(null)

    await lib.getMultiPolysFromStream(readStream, warn)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(parse).toHaveBeenCalledWith(obj, warn)
  })

  test('complicated json object sent to parser correctly', async () => {
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

    await lib.getMultiPolysFromStream(readStream, warn)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(parse).toHaveBeenCalledWith(obj, warn)
  })

  test('json object with trailing and leading whitespace', async () => {
    const obj = { a: 42 }
    const readStream = new stream.Readable()
    readStream.push(' \n\t\r ')
    readStream.push(JSON.stringify(obj))
    readStream.push(' \n\t\r ')
    readStream.push(null)

    await lib.getMultiPolysFromStream(readStream, warn)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(parse).toHaveBeenCalledWith(obj, warn)
  })

  test('json object with leading crud', () => {
    const obj = { a: 42 }
    const readStream = new stream.Readable()
    readStream.push('garbage')
    readStream.push(JSON.stringify(obj))
    readStream.push(null)

    const prom = lib.getMultiPolysFromStream(readStream, warn)
    expect(prom).rejects.toBeDefined()
  })

  test('json object with trailing crud', () => {
    const obj = { a: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj))
    readStream.push('garbage')
    readStream.push(null)

    const prom = lib.getMultiPolysFromStream(readStream, warn)
    expect(prom).rejects.toBeDefined()
  })

  test('two json objects no separation', async () => {
    const obj1 = { a: 42 }
    const obj2 = { b: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj1))
    readStream.push(JSON.stringify(obj2))
    readStream.push(null)

    await lib.getMultiPolysFromStream(readStream, warn)
    expect(parse).toHaveBeenCalledTimes(2)
    expect(parse).toHaveBeenCalledWith(obj1, warn)
    expect(parse).toHaveBeenCalledWith(obj2, warn)
  })

  test('two json objects whitespace separation', async () => {
    const obj1 = { a: 42 }
    const obj2 = { b: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj1))
    readStream.push('  \n\r \t')
    readStream.push(JSON.stringify(obj2))
    readStream.push(null)

    await lib.getMultiPolysFromStream(readStream, warn)
    expect(parse).toHaveBeenCalledTimes(2)
    expect(parse).toHaveBeenCalledWith(obj1, warn)
    expect(parse).toHaveBeenCalledWith(obj2, warn)
  })

  test('two json objects non-whitespace separation rejects', () => {
    const obj1 = { a: 42 }
    const obj2 = { b: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj1))
    readStream.push('dakfjskdf')
    readStream.push(JSON.stringify(obj2))
    readStream.push(null)

    const prom = lib.getMultiPolysFromStream(readStream, warn)
    expect(prom).rejects.toBeDefined()
  })

  test('three json objects', async () => {
    const obj1 = { a: 42 }
    const obj2 = { b: 42 }
    const obj3 = { c: 42 }
    const readStream = new stream.Readable()
    readStream.push(JSON.stringify(obj1))
    readStream.push(JSON.stringify(obj2))
    readStream.push(JSON.stringify(obj3))
    readStream.push(null)

    await lib.getMultiPolysFromStream(readStream, warn)
    expect(parse).toHaveBeenCalledTimes(3)
    expect(parse).toHaveBeenCalledWith(obj1, warn)
    expect(parse).toHaveBeenCalledWith(obj2, warn)
    expect(parse).toHaveBeenCalledWith(obj3, warn)
  })
})

describe('lib.writeOutputMultiPoly', () => {
  const tmpOutput = path.join(tmpRoot, 'out.geojson')
  const tmpNotPreExistingDir = path.join(tmpRoot, 'not-pre-existing')
  const tmpNestedOutput = path.join(tmpNotPreExistingDir, 'out.geojson')
  // *not* creating tmpNotPreExinstingDir
  beforeAll(() => setUpFs([], [tmpOutput]))
  afterAll(() =>
    tearDownFs([tmpNotPreExistingDir], [tmpOutput, tmpNestedOutput])
  )

  test('write to output file', async () => {
    const multipoly = []
    const expected = createFeatureMultiPoly(multipoly)
    const opts = {
      output: tmpOutput,
      stdout: process.stdout
    }

    await lib.writeOutputMultiPoly(opts, multipoly)
    const outString = await fs.readFileAsync(tmpOutput, 'utf8')
    expect(outString).toEqual(JSON.stringify(expected))
  })

  test('write to output file in non-existent directory', async () => {
    const multipoly = []
    const expected = createFeatureMultiPoly(multipoly)
    const opts = {
      output: tmpNestedOutput,
      stdout: process.stdout
    }

    await lib.writeOutputMultiPoly(opts, multipoly)
    const outString = await fs.readFileAsync(tmpNestedOutput, 'utf8')
    expect(outString).toEqual(JSON.stringify(expected))
  })

  test('write to stdout', async () => {
    const multipoly = []
    const expected = createFeatureMultiPoly(multipoly)

    let outString = ''
    const outStream = new stream.Writable({
      write: (chunk, encoding, callback) => {
        outString += chunk
        callback()
      }
    })

    const opts = {
      output: null,
      stdout: outStream
    }

    await lib.writeOutputMultiPoly(opts, multipoly)
    expect(outString).toEqual(JSON.stringify(expected))
  })

  test('write with a numeric id', async () => {
    const multipoly = []
    const id = 42.42
    const expected = createFeatureMultiPoly(multipoly)
    expected.id = id

    let outString = ''
    const outStream = new stream.Writable({
      write: (chunk, encoding, callback) => {
        outString += chunk
        callback()
      }
    })

    const opts = {
      stdout: outStream,
      id: id
    }

    await lib.writeOutputMultiPoly(opts, multipoly)
    expect(outString).toEqual(JSON.stringify(expected))
  })

  test('write with a string id', async () => {
    const multipoly = []
    const id = '44ff'
    const expected = createFeatureMultiPoly(multipoly)
    expected.id = id

    let outString = ''
    const outStream = new stream.Writable({
      write: (chunk, encoding, callback) => {
        outString += chunk
        callback()
      }
    })

    const opts = {
      stdout: outStream,
      id: id
    }

    await lib.writeOutputMultiPoly(opts, multipoly)
    expect(outString).toEqual(JSON.stringify(expected))
  })
})

describe('lib.doIt', () => {
  test('basic interface with polygonClipping', async () => {
    parse.mockImplementation(input => input)
    polygonClipping.union.mockImplementation(() => [])

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
    const stdinGeojson = { id: 1 }
    opts.stdin.push(JSON.stringify(stdinGeojson))
    opts.stdin.push(null)
    const expected = createFeatureMultiPoly([])

    await lib.doIt('union', [], opts)
    expect(polygonClipping.union).toHaveBeenCalledTimes(1)
    expect(polygonClipping.union).toHaveBeenCalledWith(stdinGeojson)
    expect(JSON.parse(outString)).toEqual(expected)
  })
})
