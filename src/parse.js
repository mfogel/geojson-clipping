/* Given an 'acceptable' geojson input object, parse out and return a
 * multipoly. If the object is not 'acceptable', throw an error.
 *
 * If given a feature collection with multiple feature of polys & multipolys,
 * they will be joined together to form one big (possibly overlapping)
 * multipoly.
 *
 * The definition of an 'acceptable' input geojon object can be found in the
 * README, in the section 'Input' */

// https://tools.ietf.org/html/rfc7946#section-3
const unacceptableGeojsonTypes = [
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'GeometryCollection'
]

const parse = (obj, warn) => {
  if (obj.type === 'Polygon') return parsePolygon(obj)
  if (obj.type === 'MultiPolygon') return parseMultiPolygon(obj)
  if (obj.type === 'Feature') return parseFeature(obj, warn)
  if (obj.type === 'FeatureCollection') return parseFeatureCollection(obj, warn)
  if (unacceptableGeojsonTypes.includes(obj.type)) {
    warn(`Not acceptable GeoJSON type '${obj.type}' encountered. Dropping`)
    return []
  }
  throw new Error(`Unregonized GeoJSON type ${obj.type}`)
}

const parsePolygon = obj => {
  if (!obj.coordinates) {
    throw new Error('Not GeoJSON: Polygon coordinates not defined')
  }
  if (typeof obj.coordinates[0][0][0] !== 'number') {
    throw new Error('Not GeoJSON: Polygon coordiantes malformed')
  }
  return [obj.coordinates]
}

const parseMultiPolygon = obj => {
  if (!obj.coordinates) {
    throw new Error('Not GeoJSON: MultiPolygon coordinates not defined')
  }
  // empty object
  if (obj.coordinates.length === 0) return []
  if (typeof obj.coordinates[0][0][0][0] !== 'number') {
    throw new Error('Not GeoJSON: MultiPolygon coordiantes malformed')
  }
  return obj.coordinates
}

const parseFeature = (obj, warn) => {
  const geom = obj.geometry
  if (geom.type === 'Polygon') return parsePolygon(geom)
  if (geom.type === 'MultiPolygon') return parseMultiPolygon(geom)
  if (unacceptableGeojsonTypes.includes(geom.type)) {
    warn(`Not acceptable GeoJSON type '${obj.type}' encountered. Dropping`)
    return []
  }
  throw new Error(`Unregonized Feature geometry GeoJSON type ${obj.type}`)
}

const parseFeatureCollection = (obj, warn) => {
  const mps = obj.features.map(feat => parseFeature(feat, warn))
  if (mps.length === 0) return []
  return [].concat(...mps)
}

module.exports = parse
