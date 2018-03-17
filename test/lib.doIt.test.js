/* eslint-env jest */

const path = require('path')
const stream = require('stream')
const rimraf = require('rimraf')
const lib = require('../src/lib')

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

const tmpRoot = 'test/tmp-lib-doIt-delete-me'
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

/* Make a readable stream with the given content.
 * Good for preloading stdin.. */
const makeReadStream = content => {
  const readStream = new stream.Readable({
    read (size) {
      this.push(content)
      this.push(null)
    },
    encoding: 'utf-8'
  })
  return readStream
}

/* Make a pair of: (writableStream, callback) where callback, when called,
 * will return a string containing what's been writen to the stream */
const makeWriteStreamPair = () => {
  let outString = ''
  const outStream = new stream.Writable({
    write: (chunk, encoding, callback) => {
      outString += chunk
      callback()
    }
  })
  return [outStream, () => outString]
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

describe('end-to-end no FS access', () => {
  test('stdin input', async () => {
    const coords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const input = createMultiPoly(coords)
    const expectedOutput = createFeatureMultiPoly(coords)

    const inputStream = makeReadStream(JSON.stringify(input))
    const [outputStream, outputStrGetter] = makeWriteStreamPair()
    const opts = {
      stdin: inputStream,
      stdout: outputStream
    }

    await lib.doIt('union', [], opts)
    expect(JSON.parse(outputStrGetter())).toEqual(expectedOutput)
  })

  test('-i / --id', async () => {
    const coords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const input = createMultiPoly(coords)
    const expectedOutput = createFeatureMultiPoly(coords)
    expectedOutput.id = 'yup'

    const inputStream = makeReadStream(JSON.stringify(input))
    const [outputStream, outputStrGetter] = makeWriteStreamPair()
    const opts = {
      stdin: inputStream,
      stdout: outputStream,
      id: 'yup'
    }

    await lib.doIt('intersection', [], opts)
    expect(JSON.parse(outputStrGetter())).toEqual(expectedOutput)
  })

  test('-b / --bboxes filter down based on dynamically computed bboxes', async () => {
    // doesn't really test this actually works cause it's just a perf shortcut
    // does excersize the lines in the code thou, visible in coverage reports
    const coords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const coords2 = [[[[4, 4], [5, 4], [4, 5], [4, 4]]]]
    const input = createMultiPoly(coords)
    const input2 = createMultiPoly(coords2)
    const expectedOutput = createFeatureMultiPoly(coords)

    const inputStream = makeReadStream(
      JSON.stringify(input) + JSON.stringify(input2)
    )
    const [outputStream, outputStrGetter] = makeWriteStreamPair()
    const opts = {
      stdin: inputStream,
      stdout: outputStream,
      bboxes: true
    }

    await lib.doIt('difference', [], opts)
    expect(JSON.parse(outputStrGetter())).toEqual(expectedOutput)
  })
})

describe('end-to-end with filesystem access', () => {
  const tmpFile = path.join(tmpRoot, 'file.geojson')
  const tmpDir = path.join(tmpRoot, 'dir')
  const tmpDF1 = path.join(tmpDir, 'df1.[0,0,1,1].geojson')
  const tmpDF2 = path.join(tmpDir, 'df2.[0,0,1,1].geojson')
  beforeAll(() => setUpFs([tmpDir], [tmpFile, tmpDF1, tmpDF2]))
  afterAll(() => tearDownFs([tmpDir], [tmpFile, tmpDF1, tmpDF2]))

  test('file positional input', async () => {
    const coords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const input = createMultiPoly(coords)
    await fs.writeFileAsync(tmpFile, JSON.stringify(input))
    const expectedOutput = createFeatureMultiPoly(coords)

    const [outputStream, outputStrGetter] = makeWriteStreamPair()
    const opts = {
      stdin: { isTTY: true },
      stdout: outputStream
    }

    await lib.doIt('intersection', [tmpFile], opts)
    expect(JSON.parse(outputStrGetter())).toEqual(expectedOutput)
  })

  test('directory positional input', async () => {
    const coords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const input = createMultiPoly(coords)
    await fs.writeFileAsync(tmpDF1, JSON.stringify(input))
    await fs.writeFileAsync(tmpDF2, JSON.stringify(input))
    const expectedOutput = createFeatureMultiPoly([])

    const [outputStream, outputStrGetter] = makeWriteStreamPair()
    const opts = {
      stdin: { isTTY: true },
      stdout: outputStream
    }

    await lib.doIt('xor', [tmpDir], opts)
    expect(JSON.parse(outputStrGetter())).toEqual(expectedOutput)
  })

  test('-o / --output', async () => {
    const coords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const input = createMultiPoly(coords)
    const expectedOutput = createFeatureMultiPoly(coords)

    const inputStream = makeReadStream(JSON.stringify(input))
    const opts = {
      stdin: inputStream,
      stdout: null,
      output: tmpFile
    }

    await lib.doIt('union', [], opts)
    const outputStr = await fs.readFileAsync(tmpFile, 'utf-8')
    expect(JSON.parse(outputStr)).toEqual(expectedOutput)
  })

  test('-s / --subject', async () => {
    const coords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const input = createMultiPoly(coords)
    await fs.writeFileAsync(tmpFile, JSON.stringify(input))
    const expectedOutput = createFeatureMultiPoly([])

    const inputStream = makeReadStream(JSON.stringify(input))
    const [outputStream, outputStrGetter] = makeWriteStreamPair()
    const opts = {
      stdin: inputStream,
      stdout: outputStream,
      subject: tmpFile
    }

    await lib.doIt('difference', [], opts)
    expect(JSON.parse(outputStrGetter())).toEqual(expectedOutput)
  })

  test('-b / --bboxes with empty subject', async () => {
    const coords = []
    const input = createMultiPoly(coords)
    await fs.writeFileAsync(tmpFile, JSON.stringify(input))
    const expectedOutput = createFeatureMultiPoly([])

    const inputStream = makeReadStream(JSON.stringify(input))
    const [outputStream, outputStrGetter] = makeWriteStreamPair()
    const opts = {
      stdin: inputStream,
      stdout: outputStream,
      subject: tmpFile,
      bboxes: true
    }

    await lib.doIt('difference', [], opts)
    expect(JSON.parse(outputStrGetter())).toEqual(expectedOutput)
  })

  test('-b / --bboxes filter down based on bboxes in filenames', async () => {
    // doesn't really test this actually works cause it's just a perf shortcut
    // does excersize the lines in the code thou, visible in coverage reports
    const clippingCoords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const clipping = createMultiPoly(clippingCoords)
    await fs.writeFileAsync(tmpDF1, JSON.stringify(clipping))
    await fs.writeFileAsync(tmpDF2, JSON.stringify(clipping))
    const subjectCoords = [[[[2, 2], [3, 2], [2, 3], [2, 2]]]]
    const input = createMultiPoly(subjectCoords)
    const expectedOutput = createFeatureMultiPoly(subjectCoords)

    const inputStream = makeReadStream(JSON.stringify(input))
    const [outputStream, outputStrGetter] = makeWriteStreamPair()
    const opts = {
      stdin: inputStream,
      stdout: outputStream,
      bboxes: true
    }

    await lib.doIt('difference', [tmpDir], opts)
    expect(JSON.parse(outputStrGetter())).toEqual(expectedOutput)
  })

  test('-p / --points', async () => {
    // doesn't really test this actually works cause it's just a perf shortcut
    // does excersize the lines in the code thou, visible in coverage reports
    const coords = [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    const coords2 = [[[[4, 4], [5, 4], [4, 5], [4, 4]]]]
    const coords3 = [[[[4, 4], [5, 4], [4, 5], [4, 4]]]]
    const input = createMultiPoly(coords)
    const input2 = createMultiPoly(coords2)
    const input3 = createMultiPoly(coords3)
    await fs.writeFileAsync(tmpDF1, JSON.stringify(input2))
    await fs.writeFileAsync(tmpDF2, JSON.stringify(input3))
    const expectedOutput = createFeatureMultiPoly(coords)

    const inputStream = makeReadStream(
      JSON.stringify(input) + JSON.stringify(input2) + JSON.stringify(input3)
    )
    const [outputStream, outputStrGetter] = makeWriteStreamPair()
    const opts = {
      stdin: inputStream,
      stdout: outputStream,
      points: true
    }

    await lib.doIt('xor', [tmpDir], opts)
    expect(JSON.parse(outputStrGetter())).toEqual(expectedOutput)
  })
})
