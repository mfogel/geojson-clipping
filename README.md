# geojson-clipping

Apply boolean polygon clipping operations (`union`, `intersection`, `difference`, `xor`) to Polygons & MultiPolygons in your GeoJSON files.

[![npm version](https://img.shields.io/npm/v/geojson-clipping.svg)](https://www.npmjs.com/package/geojson-clipping)
[![build status](https://img.shields.io/travis/mfogel/geojson-clipping/master.svg)](https://travis-ci.org/mfogel/geojson-clipping)
[![test coverage](https://img.shields.io/coveralls/mfogel/geojson-clipping/master.svg)](https://coveralls.io/r/mfogel/geojson-clipping)

## Quickstart

```sh
$ npm install -g geojson-clipping
$ cat poly1.geojson poly2.geojson | geojson-clipping union > union.geojson
```

## Usage

```sh
$ geojson-clipping union        [-o <path>] [<path> ... ]
$ geojson-clipping intersection [-o <path>] [<path> ... ]
$ geojson-clipping xor          [-o <path>] [<path> ... ]
$ geojson-clipping difference   [-o <path>] [<path> ... ] [ -s <path> ]
```

Input/output streams:

 * `stdin`: Input GeoJSON objects, whitespace separated, may be piped in via `stdin`.
 * `stdout` Output GeoJSON is by default written to `stdout`.
 * `stderr`: Any warnings generated are by default written to `stderr`.

### Input

Input GeoJSON objects may be provided via:

 * the positional `<path>` arguments, each of which may point to any of:
   * a GeoJSON file
   * a file with multiple GeoJSON objects in it, whitespace separated (ex: [ndjson](http://ndjson.org/))
   * a directory, in which case any files with a `.geojson` extension found immediately within it will be used as input
 * `stdin` (objects may optionally be separated by whitespace)
 * the `-s / --subject <path>` option, for the `difference()` operation only

The following [GeoJSON object types](https://tools.ietf.org/html/rfc7946#section-3) are acceptable input:

 * Polygon
 * MultiPolygon
 * Feature containing Polygon or MultiPolygon
 * FeatureCollection containing an array of acceptable Features

If a GeoJSON object with a different type is encountered (ex: Point) the offending object will be dropped and a warning will be printed to `stderr`.

### Output

The computed GeoJSON is by default written to `stdout`, but may be redirected using the `-o / --output <path>` option. The output GeoJSON will have the following properties:

 * it will be a single GeoJSON Feature object with a geometry of type MultiPolygon.
 * the Feature's properties attribute will be set to `null`.
 * if the geometry of resulting from the operation is the empty set (ex: intersection of non-overlapping polygons) then the coordinates of the MultiPolygon will be `[]`.
 * it will have the [qualities guaranteed by polygon-clipping](https://github.com/mfogel/polygon-clipping#output).

## Options

### `-s / --subject <path>`

Valid *only* for `difference()` operation. Invalid for other operations.

Use the file identified by `<path>` as input GeoJSON, and consider it to be the `subject` in the `difference()` operation. That is to say, all other GeoJSON objects will be subtracted from this GeoJSON object.

If this option is not supplied, the `subject` will by default be the first GeoJSON object read in from `stdin`.

### `-b / --bboxes`

Valid *only* for `difference()` operation. Invalid for other operations.

Scan input GeoJSON filenames for pre-computed stringified [bounding boxes](https://tools.ietf.org/html/rfc7946#section-5). If no bounding box is found in the filename, then compute a bounding box from the GeoJSON coordinates. Examples of filenames containing bounding boxes:

* `[-10,-10,10,10].json`
* `424242.[-58.5314588,-34.705637,-58.3351249,-34.5265535].geojson`

If a the bounding box of a given GeoJSON object does not overlap the bounding box of the `subject`, that GeoJSON object is dropped from the calculation as it cannot contribute to the end result, resulting in a performance boost. In the case that the bounding box was extracted from the filename, the non-contributing GeoJSON object is dropped *without* reading the file in from disk.

### `-o / --output <path>`

Write the output GeoJSON object out to a newly-created file located at `<path>`.

If this option is not supplied, the ouput GeoJSON will be written to `stdout`.

### `-i / --id <id>`

Add to the output GeoJSON object the [Feature id](https://tools.ietf.org/html/rfc7946#section-3.2) `<id>`. If `<id>` can be parsed as a number it will be written into the output GeoJSON as a number, else it will be written out as a string.

If this option is not supplied, the output GeoJSON will not have a Feature id.

### `-q / --quiet`

Suppress any warnings generated.

If this option is not supplied, any warnings generated will be written to `stderr`.

### `-h / --help`

Display help message and exit.

### `-v / --version`

Display version string and exit.

## Examples

Equivalent ways to take the `union` of three GeoJSON objects:

```sh
$ cat poly1.geojson poly2.geojson poly3.geojson | geojson-clipping union > union.geojson
$ geojson-clipping union poly1.geojson poly2.geojson poly3.geojson > union.geojson
$ geojson-clipping union -o union.geojson poly1.geojson poly2.geojson poly3.geojson
```

Equivalent ways to take the `difference` (aka subtract) a directory full of GeoJSON objects from another GeoJSON object:

```sh
$ cat subject.geojson | geojson-clipping difference ./directory-with-geojson-files > difference.geojson
$ geojson-clipping difference -s subject.geojson -o difference.geojson ./directory-with-geojson-files
```

## Changelog

### 0.3 (2018-04-01)

* Performance improvements
* enhance `-b / --bboxes` to better support bounding boxes that cross the antimeridian [#4](https://github.com/mfogel/geojson-clipping/issues/4)

### 0.2 (2018-03-09)

* add `-i / --id <id>` option [#3](https://github.com/mfogel/geojson-clipping/issues/3)
* add `-b / --bboxes` option for `difference()` operation [#2](https://github.com/mfogel/geojson-clipping/issues/2)
* create output directories as needed [#1](https://github.com/mfogel/geojson-clipping/issues/1)

### 0.1 (2018-03-07)

* Initial release
