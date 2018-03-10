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

  // change a coordinate from 0 is prime merdian to 0 is anti merdian
  // and vice-versa
  const flipCoord = x => (x > 0 ? x - 180 : x + 180)

  for (const poly of multipoly) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        south = Math.min(south, y)
        north = Math.max(north, y)
        westAM = Math.min(westAM, x)
        eastAM = Math.max(eastAM, x)
        westPM = Math.min(westPM, flipCoord(x))
        eastPM = Math.max(eastPM, flipCoord(x))
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
