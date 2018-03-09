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
  const [NI, PI] = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
  const bbox = [PI, PI, NI, NI]
  for (const poly of multipoly) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        bbox[0] = Math.min(bbox[0], x)
        bbox[1] = Math.min(bbox[1], y)
        bbox[2] = Math.max(bbox[2], x)
        bbox[3] = Math.max(bbox[3], y)
      }
    }
  }
  if (bbox[0] === PI) {
    throw new Error('Unable to compute bbox: no points in multipoly')
  }
  return bbox
}

const doBboxesOverlap = (bbox1, bbox2) => {
  let [x1min, y1min, x1max, y1max] = bbox1
  let [x2min, y2min, x2max, y2max] = bbox2

  /* account for antimeridian cutting
   * https://tools.ietf.org/html/rfc7946#section-5.2 */
  if (x1min > x1max) x1min -= 360
  if (x2min > x2max) x2min -= 360

  if (x2min > x1max || y2min > y1max) return false
  if (x1min > x2max || y1min > y2max) return false
  return true
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
