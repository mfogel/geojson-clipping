const numRegex = '-?[0-9]+.?[0-9]*'
const bboxRegex = RegExp(
  `\\[${numRegex},${numRegex},${numRegex},${numRegex}\\]`
)

/* Parse a bounding box out from a filename. Returns null if none found. */
const getBboxFromFilename = fn => {
  const match = bboxRegex.exec(fn)
  if (match === null || match.length > 1) return null
  return JSON.parse(match[0])
}

/* Get a bounding box from a multipolygon */
const getBboxFromMultiPoly = multipoly => {
  // calculate two possible bounding boxes: one that is cut on the
  // antimeridian (traditional) and one cut on the primemerdian
  // If they're different, take the smaller one

  let south = Number.POSITIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY
  let westAM = Number.POSITIVE_INFINITY
  let eastAM = Number.NEGATIVE_INFINITY
  let westPM = Number.POSITIVE_INFINITY
  let eastPM = Number.NEGATIVE_INFINITY

  // normally 0 is the prime merdian and 180 the anti
  // this flips a coordinate so 0 is the anit 180 the prime
  const flipCoord = x => (x > 0 ? x - 180 : x + 180)

  // performance-optimized looping over coordinates
  for (let i = 0, iMax = multipoly.length; i < iMax; i++) {
    const poly = multipoly[i]

    for (let j = 0, jMax = poly.length; j < jMax; j++) {
      const ring = poly[j]

      for (let k = 0, kMax = ring.length; k < kMax; k++) {
        const x = ring[k][0]
        const y = ring[k][1]
        const xPM = flipCoord(x)

        if (y < south) south = y
        if (y > north) north = y

        if (x < westAM) westAM = x
        if (x > eastAM) eastAM = x

        if (xPM < westPM) westPM = xPM
        if (xPM > eastPM) eastPM = xPM
      }
    }
  }

  if (south === Number.POSITIVE_INFINITY) {
    throw new Error('Unable to compute bbox: no points in multipoly')
  }

  const extentAM = eastAM - westAM
  const extentPM = eastPM - westPM

  const bboxAM = [westAM, south, eastAM, north]
  const bboxPM = [flipCoord(westPM), south, flipCoord(eastPM), north]

  return extentPM < extentAM ? bboxPM : bboxAM
}

const doBboxesOverlap = (bbox1, bbox2) => {
  let [w1, s1, e1, n1] = bbox1
  let [w2, s2, e2, n2] = bbox2

  if (n2 < s1 || n1 < s2) return false

  // supporting antimerdian-crossing bboxes
  const isBetween = (west, east, spot) => {
    if (west <= east) return west <= spot && spot <= east
    return (west <= spot && spot <= 180) || (spot >= -180 && spot <= east)
  }

  return isBetween(w1, e1, w2) || isBetween(w2, e2, w1)
}

/* Return an array of filenames that either:
 *  - don't have a bbox in the filename
 *  - have a bbox in the filename that overlaps with the given bbox */
const filterDownFilenames = (filePaths, bbox) => {
  const couldHaveOverlap = fp => {
    const thisBbox = getBboxFromFilename(fp)
    return thisBbox ? doBboxesOverlap(bbox, thisBbox) : true
  }
  return filePaths.filter(couldHaveOverlap)
}

/* Return an array of multipolys whos bbox overlaps with the bbox */
const filterDownMultiPolys = (multipolys, bbox) => {
  const overlaps = mp => doBboxesOverlap(bbox, getBboxFromMultiPoly(mp))
  return multipolys.filter(overlaps)
}

module.exports = {
  bboxRegex,
  doBboxesOverlap,
  getBboxFromMultiPoly,
  getBboxFromFilename,
  filterDownFilenames,
  filterDownMultiPolys
}
