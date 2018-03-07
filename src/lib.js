const fs = require('fs')
const path = require('path')
const polygonClipping = require('polygon-clipping')
const split = require('split')
const parse = require('./parse')

/* Get the output write stream */
const getOutputStream = opts =>
  opts.output ? fs.createWriteStream(opts.output, { mode: 0o644 }) : opts.stdout

/* Scan a directory for .geojson files and create & return an array
 * of readStreams, one for each found */
const getReadStreamsFromDir = dir =>
  fs
    .readdirSync(dir)
    .filter(fn => path.extname(fn) === '.geojson')
    .map(fn => fs.createReadStream(path.join(dir, fn)))

/* Get an array of the input streams, with the subject input stream
 * at the front. */
const getInputStreams = (positionals, opts) => {
  const streams = []
  if (opts.subject) streams.push(fs.createReadStream(opts.subject))
  if (!opts.stdin.isTTY) streams.push(opts.stdin)

  positionals.forEach(pos => {
    if (fs.statSync(pos).isDirectory()) {
      streams.push(...getReadStreamsFromDir(pos))
    } else streams.push(fs.createReadStream(pos))
  })

  return streams
}

/* Get an array of multipolygons from the given read stream.
 * One multipolygon will be returned per acceptable GeoJSON object.
 * If any unacceptable GeoJSON objects (ie not polyons/multipolygons,
 * a warning will be emited using the provided warn() callback. */
const getMultiPolysFromStream = async (readStream, warn) =>
  new Promise((resolve, reject) => {
    const mpStrs = []
    readStream
      .pipe(split(/}\s*{/))
      .on('data', chunk => {
        if (chunk) mpStrs.push(chunk)
      })
      .on('end', () => {
        mpStrs.forEach((mpStr, i) => {
          if (i !== 0) mpStr = '{' + mpStr
          if (i !== mpStrs.length - 1) mpStr = mpStr + '}'
          mpStrs[i] = mpStr
        })

        let mps
        try {
          mps = mpStrs.map(mpStr => parse(JSON.parse(mpStr)))
        } catch (err) {
          return reject(err)
        }
        return resolve(mps)
      })
  })

/* Write the given multipoly out, as GeoJSON, to the given stream */
const writeMultiPolyToStream = async (stream, multiPoly) =>
  new Promise((resolve, reject) => {
    const geojson = {
      type: 'Feature',
      properties: null,
      geometry: {
        type: 'MultiPolygon',
        coordinates: multiPoly
      }
    }
    stream.write(JSON.stringify(geojson), 'utf-8', resolve)
  })

async function doIt (operation, positionals, opts) {
  const inputMps = await Promise.all(
    getInputStreams(positionals, opts).map(getMultiPolysFromStream)
  )
  const inputMpsFlattened = [].concat(...inputMps)
  const outputMp = polygonClipping[operation](...inputMpsFlattened)
  const outputStream = getOutputStream(opts)
  await writeMultiPolyToStream(outputStream, outputMp)
}

module.exports = {
  getOutputStream,
  getInputStreams,
  getReadStreamsFromDir,
  getMultiPolysFromStream,
  writeMultiPolyToStream,
  doIt
}
