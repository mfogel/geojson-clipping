/* eslint-env jest */

const parse = require('../src/parse')

describe('parse', () => {
  test('empty object', () => {
    const obj = {}
    expect(() => parse(obj)).toThrow()
  })

  test('object with invalid type', () => {
    const obj = { type: 234 }
    expect(() => parse(obj)).toThrow()
  })

  test('Polygon with no coordiantes property', () => {
    const obj = { type: 'Polygon' }
    expect(() => parse(obj)).toThrow()
  })

  test('Polygon with invalid coordiantes', () => {
    const obj = {
      type: 'Polygon',
      coordinates: [[['a']]]
    }
    expect(() => parse(obj)).toThrow()
  })

  test('valid Polygon', () => {
    const obj = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]]
    }

    const coords = parse(obj)
    expect(coords).toEqual([[obj.coordinates]])
  })

  test('MultiPolygon with no coordiantes property', () => {
    const obj = { type: 'MultiPolygon' }
    expect(() => parse(obj)).toThrow()
  })

  test('MulitPolygon with invalid coordiantes', () => {
    const obj = {
      type: 'MultiPolygon',
      coordinates: [[[[{}]]]]
    }
    expect(() => parse(obj)).toThrow()
  })

  test('valid MultiPolygon', () => {
    const obj = {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
    }

    const coords = parse(obj)
    expect(coords).toEqual([obj.coordinates])
  })

  test('valid empty MultiPolygon', () => {
    const obj = {
      type: 'MultiPolygon',
      coordinates: []
    }

    const coords = parse(obj)
    expect(coords).toEqual([[]])
  })

  test('Feature with no geometry property', () => {
    const obj = { type: 'Feature' }
    expect(() => parse(obj)).toThrow()
  })

  test('Feature no geometry type', () => {
    const obj = {
      type: 'Feature',
      geometry: {}
    }
    expect(() => parse(obj)).toThrow()
  })

  test('Feature invliad geometry type', () => {
    const obj = {
      type: 'Feature',
      geometry: { type: 42 }
    }
    expect(() => parse(obj)).toThrow()
  })

  test('Feature with valid MultiPolygon', () => {
    const obj = {
      type: 'Feature',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[[0, 0], [1, 0], [0, 1], [0, 0]]]]
      }
    }

    const coords = parse(obj)
    expect(coords).toEqual([obj.geometry.coordinates])
  })

  test('Feature with valid Polygon', () => {
    const obj = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]]
      }
    }

    const coords = parse(obj)
    expect(coords).toEqual([[obj.geometry.coordinates]])
  })

  test('FeatureCollection with no features property', () => {
    const obj = { type: 'FeatureCollection' }
    expect(() => parse(obj)).toThrow()
  })

  test('FeatureCollection with invalid features property', () => {
    const obj = {
      type: 'FeatureCollection',
      features: 42
    }
    expect(() => parse(obj)).toThrow()
  })

  test('FeatureCollection with empty features', () => {
    const obj = {
      type: 'FeatureCollection',
      features: []
    }

    const coords = parse(obj)
    expect(coords).toEqual([[]])
  })

  test('FeatureCollection with one feature, a Poly', () => {
    const obj = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]]
          }
        }
      ]
    }

    const coords = parse(obj)
    expect(coords).toEqual([[obj.features[0].geometry.coordinates]])
  })

  test('FeatureCollection with one valid feature and one invalid', () => {
    const obj = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]]
          }
        },
        {
          type: 'Feature',
          geometry: 42
        }
      ]
    }
    expect(() => parse(obj)).toThrow()
  })

  test('FeatureCollection with two features, a Poly & MultiPoly', () => {
    const obj = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]]
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: [[[[0, 0], [2, 0], [0, 2], [0, 0]]]]
          }
        }
      ]
    }

    const coords = parse(obj)
    expect(coords).toEqual([
      [obj.features[0].geometry.coordinates],
      obj.features[1].geometry.coordinates
    ])
  })
})
