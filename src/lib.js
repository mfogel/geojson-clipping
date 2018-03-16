const path = require('path')
const mkdirp = require('mkdirp')
const polygonClipping = require('polygon-clipping')
const split = require('split')
const bbox = require('./bbox')
const parse = require('./parse')

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

/* Counter of number of points read in from input streams.
 * Used with option -p / --points to limit memory usage */
let POINT_CNT = 0

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

/* Get the number of points in an array of multipolys */
const countPoints = mps => {
  let cnt = 0
  for (let i = 0, iMax = mps.length; i < iMax; i++) {
    const mp = mps[i]
    for (let j = 0, jMax = mp.length; j < jMax; j++) {
      const poly = mp[j]
      for (let k = 0, kMax = poly.length; k < kMax; k++) {
        cnt += poly[k].length
      }
    }
  }
  return cnt
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
        POINT_CNT += countPoints(mps)
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
  const streams = getSubjectAndStdinStreams(opts)
  let fps = [].concat(...(await Promise.all(positionals.map(getFilePaths))))

  let subject = null
  let subjectBbox = null
  let mps = []

  // attempt to get the subject, if specified (defaulting to stdin if not)
  if (streams.length > 0) {
    mps = await getMultiPolysFromStream(streams.shift(), opts.warn)
    subject = mps.shift()
  }

  // trim the positional arguments for the -b / --bboxes option, if requested
  if (opts.bboxes) {
    if (!subject) return [] // no subject, so nothing can overlap
    subjectBbox = bbox.getBboxFromMultiPoly(subject)
    fps = bbox.filterDownFilenames(fps, subjectBbox)
  }

  // convert positional arguments to input streams
  streams.push(...fps.map(fp => fs.createReadStream(fp)))

  // initialize our 'result' as either subject or first mp from positionals
  let result = null
  if (subject) result = subject
  else {
    mps = await getMultiPolysFromStream(streams.shift(), opts.warn)
    result = mps.shift()
  }

  while (mps.length > 0 || streams.length > 0) {
    // read in input mps, until we hit opts.points or run out of inputs
    while (streams.length && POINT_CNT < opts.points) {
      mps.push(...(await getMultiPolysFromStream(streams.shift(), opts.warn)))
    }
    // filter those down by bbox if requested
    if (subjectBbox) mps = bbox.filterDownMultiPolys(mps, subjectBbox)
    // do the operation
    result = polygonClipping[operation](result, ...mps)
    mps = []
  }

  return writeOutputMultiPoly(opts, result)
}

module.exports = {
  getFilePaths,
  getSubjectAndStdinStreams,
  getMultiPolysFromStream,
  writeOutputMultiPoly,
  doIt
}
