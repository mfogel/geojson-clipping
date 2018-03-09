/* eslint-env jest */

const bbox = require('../src/bbox')

describe('bbox.getBboxFromFilename', () => {
  test('no match', () => {
    const fn = 'tmp1.geojson'
    expect(bbox.getBboxFromFilename(fn)).toBe(null)
  })

  test('match correctly', () => {
    const fn = 'tmp.[0,0,0,0].geojson'
    expect(bbox.getBboxFromFilename(fn)).toEqual([0, 0, 0, 0])
  })

  test('two bboxes, first should be matched', () => {
    const fn = 'tmp.[0,0,0,0].blah.[1,1,1,1].json'
    expect(bbox.getBboxFromFilename(fn)).toEqual([0, 0, 0, 0])
  })
})

describe('bbox.getBboxFromMultiPoly', () => {
  test('no points', () => {
    const mp = [[[]]]
    expect(() => bbox.getBboxFromMultiPoly(mp)).toThrow()
  })

  test('one point', () => {
    const mp = [[[[0, 0]]]]
    expect(bbox.getBboxFromMultiPoly(mp)).toEqual([0, 0, 0, 0])
  })

  test('two points', () => {
    const mp = [[[[0, 0], [1, 1]]]]
    expect(bbox.getBboxFromMultiPoly(mp)).toEqual([0, 0, 1, 1])
  })

  test('two rings', () => {
    const mp = [[[[0, 0]], [[1, 1]]]]
    expect(bbox.getBboxFromMultiPoly(mp)).toEqual([0, 0, 1, 1])
  })

  test('two polys', () => {
    const mp = [[[[0, 0]]], [[[1, 1]]]]
    expect(bbox.getBboxFromMultiPoly(mp)).toEqual([0, 0, 1, 1])
  })

  test('more points', () => {
    const mp = [[[[0, 0], [1, 1], [-1, -1], [-3, 4]]]]
    expect(bbox.getBboxFromMultiPoly(mp)).toEqual([-3, -1, 1, 4])
  })
})

describe('bbox.bboxRegex', () => {
  test('misses', () => {
    expect(bbox.bboxRegex.test('')).toBe(false)
    expect(bbox.bboxRegex.test('[]')).toBe(false)
    expect(bbox.bboxRegex.test('[234]')).toBe(false)
    expect(bbox.bboxRegex.test('[,,,]')).toBe(false)
    expect(bbox.bboxRegex.test('[a,b,c,]')).toBe(false)
    expect(bbox.bboxRegex.test('[-,-,-,]')).toBe(false)
    expect(bbox.bboxRegex.test('[-234.34]')).toBe(false)
    expect(bbox.bboxRegex.test('[-,4,3,4]')).toBe(false)
  })

  test('hits', () => {
    expect(bbox.bboxRegex.test('[0,0,0,0]')).toBe(true)
    expect(bbox.bboxRegex.test('asdf.[0,0,0,0].asdflkj')).toBe(true)
    expect(bbox.bboxRegex.test('[-0,-0,-0,-0]')).toBe(true)
    expect(bbox.bboxRegex.test('[4.,4,-3,34]')).toBe(true)
    expect(bbox.bboxRegex.test('[-2.3,5.4,-2.5,2.3][0,0,0,0]')).toBe(true)
  })
})

describe('bbox.doBboxesOverlap', () => {
  test('misses', () => {
    expect(bbox.doBboxesOverlap([0, 0, 1, 1], [2, 2, 3, 3])).toBe(false)
    expect(bbox.doBboxesOverlap([0, 0, 1, 1], [-4, -4, -3, -3])).toBe(false)
    expect(bbox.doBboxesOverlap([0, 0, 10, 10], [12, 2, 13, 3])).toBe(false)
    expect(bbox.doBboxesOverlap([0, 0, 10, 10], [2, 12, 3, 13])).toBe(false)
  })

  test('hits', () => {
    expect(bbox.doBboxesOverlap([0, 0, 10, 10], [2, 2, 3, 3])).toBe(true)
    expect(bbox.doBboxesOverlap([0, 0, 10, 10], [8, 8, 13, 13])).toBe(true)
    expect(bbox.doBboxesOverlap([0, 0, 10, 10], [-8, -8, 13, 13])).toBe(true)
    expect(bbox.doBboxesOverlap([0, 0, 10, 10], [-8, -8, 3, 3])).toBe(true)
  })

  test('antimeridian', () => {
    expect(bbox.doBboxesOverlap([175, 0, -175, 1], [2, 2, 3, 3])).toBe(false)
    expect(bbox.doBboxesOverlap([2, 2, 3, 3], [175, 0, -175, 1])).toBe(false)
    expect(bbox.doBboxesOverlap([175, 0, -175, 1], [-177, -1, -176, 3])).toBe(
      true
    )
  })
})

describe('bbox.filterDownFilenames', () => {
  test('empty list', () => {
    const b = [0, 0, 0, 0]
    expect(bbox.filterDownFilenames([], b)).toEqual([])
  })

  test('no filtering', () => {
    const b = [0, 0, 1, 1]
    const fps = ['[0,0,3,3]', '[0,0,5,5]', 'no-bbox']
    expect(bbox.filterDownFilenames(fps, b)).toEqual(fps)
  })

  test('some filtered', () => {
    const b = [0, 0, 1, 1]
    const fps = ['[0,0,3,3]', '[4,4,5,5]']
    expect(bbox.filterDownFilenames(fps, b)).toEqual([fps[0]])
  })

  test('all filtered', () => {
    const b = [0, 0, 1, 1]
    const fps = ['[2,2,3,3]', '[4,4,5,5]']
    expect(bbox.filterDownFilenames(fps, b)).toEqual([])
  })
})

describe('bbox.filterDownMultiPolys', () => {
  test('empty list', () => {
    const b = [0, 0, 0, 0]
    expect(bbox.filterDownMultiPolys([], b)).toEqual([])
  })

  test('no filtering', () => {
    const b = [-1, -1, 1, 1]
    const mps = [
      [[[[-3, -3], [0, -3], [0, 0], [-3, 0], [-3, -3]]]],
      [[[[0, 0], [3, 0], [3, 3], [0, 3], [0, 0]]]]
    ]
    expect(bbox.filterDownMultiPolys(mps, b)).toEqual(mps)
  })

  test('some filtered', () => {
    const b = [-1, -1, 1, 1]
    const mps = [
      [[[[-3, -3], [0, -3], [0, 0], [-3, 0], [-3, -3]]]],
      [[[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]]]
    ]
    expect(bbox.filterDownMultiPolys(mps, b)).toEqual([mps[0]])
  })

  test('all filtered', () => {
    const b = [-1, -1, 1, 1]
    const mps = [
      [[[[-3, -3], [-2, -3], [-2, -2], [-3, -2], [-3, -3]]]],
      [[[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]]]
    ]
    expect(bbox.filterDownMultiPolys(mps, b)).toEqual([])
  })
})
