## NOTE: this project is in active development and has not yet been released. Features described below may not exist yet.

# geojson-clipping

Apply boolean polygon clipping operations (`union`, `intersection`, `difference`, `xor`) to Polygons & MultiPolygons in your GeoJSON files.

[![npm version](https://img.shields.io/npm/v/geojson-clipping.svg)](https://www.npmjs.com/package/geojson-clipping)
[![build status](https://img.shields.io/travis/mfogel/geojson-clipping.svg)](https://travis-ci.org/mfogel/geojson-clipping)
[![test coverage](https://img.shields.io/coveralls/mfogel/geojson-clipping/master.svg)](https://coveralls.io/r/mfogel/geojson-clipping)

## Quickstart

```sh
$ npm install -g geojson-clipping
$ cat poly1.geojson poly2.geojson | geojson-clipping union > poly-union.geojson
```

## Usage

`geojson-clipping <command> [-s <path> | - ] [-f <path>] [-d <path>] [-o <path>]`

 * `<command>` may be one of `union`, `intersection`, `difference`, or `xor`.
 * One or more GeoJSON objects containing Polygons and/or MultiPolygons are expected via `stdin`, or via the options `-s`, `-f`, and/or `-d`.
 * By default the output is written to `stdout`, unless the `-o` option has been used to specify an alternative destination.

### Input

The following [GeoJSON object types](https://tools.ietf.org/html/rfc7946#section-3) are acceptable:

 * Polygon
 * MultiPolygon
 * Feature containing Polygon or MultiPolygon
 * FeatureCollection containing an array of acceptable Features

If a geojson object with a different type is encountered (ex: Point) the offending object will be dropped and a warning will be printed to `stderr`.

The geojson objects consumed on stdin may be separated by zero or more characters of whitespace.

### Output

The output will be a single GeoJSON object of type MultiPolygon. If the output is the empty set (ex: intersection of non-overlapping polygons) the output will be a MultiPolygon with coordinates `[]`.

The output is gauranteed to have the [qualities gauranteed by polygon-clipping](https://github.com/mfogel/polygon-clipping#output).

## Options

### `-s / --subject <path>`

**Required** for `difference()` operation. Invalid for other operations.

Specifies which geojson object to consider the `subject` in the `difference()` operation. That is to say, all other geojson objects will be subtracted *from* this geojson object.

If `<path>` *is not* the string `-`, consume the geojson file located at `<path>` and treat it as the `subject`.

If `<path>` *is* the string `-`, treat the first geojson object consumed via stdin as the `subject`.

### `-f / --file <path>`

Consume the geojson file located at `<path>`.

May be used multiple times.

### `-d / --directory <path>`

Scan the directory located at `<path>` for geojson files (files with an extension `.geojson`), and consume all that are found.

May be used multiple times.

### `-o / --output <path>`

Write the computed geojson object out to a newly-created file located at `<path>`. If not specified, the computed geojson will be written to `stdout`.

## Changelog

### 0.1

* Initial release
