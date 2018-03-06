/* Given an 'acceptable' geojson input object, parse out and return an
 * array of multipolys. If the object is not 'acceptable', throw an error.
 *
 * The definition of an 'acceptable' input geojon object can be found in the
 * README, in the section 'Input' */
const parse = obj => {
  if (obj.type === 'Polygon') return parsePolygon(obj)
  if (obj.type === 'MultiPolygon') return parseMultiPolygon(obj)
  if (obj.type === 'Feature') return parseFeature(obj)
  if (obj.type === 'FeatureCollection') return parseFeatureCollection(obj)
  throw new Error(`Not acceptable GeoJSON type: '${obj.type}'`)
}

const parsePolygon = obj => {
  if (!obj.coordinates) {
    throw new Error('Not GeoJSON: Polygon coordinates not defined')
  }
  if (typeof obj.coordinates[0][0][0] !== 'number') {
    throw new Error('Not GeoJSON: Polygon coordiantes malformed')
  }
  return [[obj.coordinates]]
}

const parseMultiPolygon = obj => {
  if (!obj.coordinates) {
    throw new Error('Not GeoJSON: MultiPolygon coordinates not defined')
  }
  // empty object
  if (obj.coordinates.length === 0) return [[]]
  if (typeof obj.coordinates[0][0][0][0] !== 'number') {
    throw new Error('Not GeoJSON: MultiPolygon coordiantes malformed')
  }
  return [obj.coordinates]
}

const parseFeature = obj => {
  const geom = obj.geometry
  if (geom.type === 'Polygon') return parsePolygon(geom)
  if (geom.type === 'MultiPolygon') return parseMultiPolygon(geom)
  throw new Error(
    `Not acceptable GeoJSON Feature geometry type: '${geom.type}'`
  )
}

const parseFeatureCollection = obj => {
  const mps = obj.features.map(feat => parseFeature(feat)[0])
  if (mps.length === 0) mps.push([])
  return mps
}

module.exports = parse
