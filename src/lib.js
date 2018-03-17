const path = require('path')
const mkdirp = require('mkdirp')
const polygonClipping = require('polygon-clipping')
const split = require('split')
const bbox = require('./bbox')
const parse = require('./parse')

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

/* Get an array of the subject and stdin read streams, if they're valid.
 * If the subject isn't specified in opts, it won't be present.
 * If stdin doesn't have something being piped to it, it will be excluded.
 * The first element of the list will be the one to use as subject. */
const getSubjectAndStdinStreams = opts => {
  const streams = []
  if (opts.subject) streams.push(fs.createReadStream(opts.subject))
  if (!opts.stdin.isTTY) streams.push(opts.stdin)
  return streams
}

/* Get an array of paths to geojson files for the given filesystem path.
 * If the given path is a file, one path will be returned.
 * If the given path is a directory, zero or more paths will be returned. */
const getFilePaths = async fsPath => {
  const stat = await fs.statAsync(fsPath)
  if (!stat.isDirectory()) return [fsPath]
  const files = await fs.readdirAsync(fsPath)
  return files
    .filter(fn => path.extname(fn) === '.geojson')
    .map(fn => path.join(fsPath, fn))
}

/* Get an array of the input streams, with the subject input stream
 * at the front. */
const getInputMultiPolys = async (positionals, opts) => {
  // mpa: MultiPolygon array, fp: file path
  const getMpa = stream => getMultiPolysFromStream(stream, opts.warn)
  const getMpaFromFp = fp => getMpa(fs.createReadStream(fp))
  const mpas = await Promise.all(getSubjectAndStdinStreams(opts).map(getMpa))

  // if opts.bboxes is set, filter down files & mps based bboxes
  const subject = mpas.length > 0 && mpas[0].length > 0 ? mpas[0][0] : null
  // no subject, so nothing can overlap
  const subjectBbox =
    opts.bboxes && subject && subject.length > 0
      ? bbox.getBboxFromMultiPoly(subject)
      : null

  let fps = [].concat(...(await Promise.all(positionals.map(getFilePaths))))
  if (subjectBbox) fps = bbox.filterDownFilenames(fps, subjectBbox)

  mpas.push(...(await Promise.all(fps.map(getMpaFromFp))))
  let mps = [].concat(...mpas)
  if (subjectBbox) mps = bbox.filterDownMultiPolys(mps, subjectBbox)

  return mps
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
        for (let [i, mpStr] of mpStrs.entries()) {
          if (i !== 0) mpStr = '{' + mpStr
          if (i !== mpStrs.length - 1) mpStr = mpStr + '}'
          mpStrs[i] = mpStr
        }

        let mps
        try {
          mps = mpStrs.map(mpStr => parse(JSON.parse(mpStr), warn))
        } catch (err) {
          return reject(err)
        }
        return resolve(mps)
      })
  })

/* Write the given multipoly out, as GeoJSON, to the output */
const writeOutputMultiPoly = async (opts, multiPoly) =>
  new Promise((resolve, reject) => {
    let stream = opts.stdout
    if (opts.output) {
      mkdirp(path.dirname(opts.output))
      stream = fs.createWriteStream(opts.output)
    }
    const geojson = {
      type: 'Feature',
      properties: null,
      geometry: {
        type: 'MultiPolygon',
        coordinates: multiPoly
      }
    }
    if (opts.id) geojson.id = opts.id
    stream.write(JSON.stringify(geojson), 'utf-8', resolve)
  })

async function doIt (operation, positionals, opts) {
  const inputMps = await getInputMultiPolys(positionals, opts)
  const outputMp = polygonClipping[operation](...inputMps)
  return writeOutputMultiPoly(opts, outputMp)
}

module.exports = {
  getFilePaths,
  getSubjectAndStdinStreams,
  getInputMultiPolys,
  getMultiPolysFromStream,
  writeOutputMultiPoly,
  doIt
}
