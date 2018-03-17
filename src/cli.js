#!/usr/bin/env node

const path = require('path')
const process = require('process')
const yargs = require('yargs')
const lib = require('./lib')

// Allow the test runner to request, via env vars, to mock out lib.doIt
// Note that normal mocking doesn't work as this is run as a separate process.
if (process.env['NODE_ENV'] === 'test' && process.env['NODE_MOCK_DOIT']) {
  lib.doIt = (operation, positionals, opts) => {
    // these don't stringify well, change them
    opts.stdin = opts.stdin.isTTY ? 'terminal' : 'piped'
    opts.stdout = opts.stdout.isTTY ? 'terminal' : 'piped'
    opts.warn = opts.warn === console.warn ? 'console' : 'none'
    console.log(
      JSON.stringify({
        operation: operation,
        positionals: positionals,
        opts: opts
      })
    )
  }
}

const handler = argv => {
  const command = argv._[0]
  const positionals = argv._.slice(1)
  const opts = {
    bboxes: argv.bboxes,
    id: argv.id,
    output: argv.output,
    points: argv.points,
    subject: argv.subject,
    stdin: process.stdin,
    stdout: process.stdout,
    warn: argv.quiet ? () => {} : console.warn
  }

  // if we don't have anything being piped in via stdin,
  // nor any GeoJSON specified as positionals... show the help
  if (process.stdin.isTTY && positionals.length === 0) {
    yargs.showHelp()
    console.error('Please provide some GeoJSON via stdin or positionals')
    process.exit(1)
  }

  // difference() requires either input from stdin, or the
  // --subject option to be set
  if (command === 'difference' && process.stdin.isTTY && !opts.subject) {
    yargs.showHelp()
    console.error(
      'difference requires either input on stdin or -s / --subject to be set'
    )
    process.exit(1)
  }

  try {
    lib.doIt(command, positionals, opts)
  } catch (err) {
    // If we're in a development scenario (aka this file was directly executed)
    // throw an eror that will include a stacktrace. Else, display a cleaner error.
    if (argv['$0'] === path.basename(__filename)) throw err
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }
}

yargs
  .command('union', 'Compute the union', {}, handler)
  .command('intersection', 'Compute the intersection', {}, handler)
  .command(
    'difference',
    'Compute the difference',
    yargs =>
      yargs
        .option('s', {
          alias: 'subject',
          describe: 'GeoJSON file containing subject',
          type: 'string',
          requiresArg: true,
          normalize: true
        })
        .option('b', {
          alias: 'bboxes',
          describe: 'Respect any pre-computed bounding boxes found',
          type: 'boolean'
        }),
    handler
  )
  .command('xor', 'Compute the xor', {}, handler)
  .demandCommand(1, 'Please specify a command')
  .option('o', {
    alias: 'output',
    describe: 'File to write resulting GeoJSON out to',
    type: 'string',
    requiresArg: true,
    normalize: true
  })
  .option('i', {
    alias: 'id',
    describe: 'GeoJSON Feature id to add to output GeoJSON',
    corece: arg => Number.parseFloat(arg),
    requiresArg: true
  })
  .option('p', {
    alias: 'points',
    describe: 'Goal number of points to process at a time',
    default: 1000,
    type: 'number',
    requiresArg: true
  })
  .option('q', {
    alias: 'quiet',
    describe: 'Suppress warnings',
    type: 'boolean'
  })
  .alias('h', 'help')
  .alias('v', 'version')
  .strict()
  .parse()
