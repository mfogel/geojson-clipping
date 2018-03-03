#!/usr/bin/env node

const path = require('path')
const process = require('process')
const yargs = require('yargs')
const doOperation = require('./src')

const handler = argv => {
  const command = argv._[0]
  const positionals = argv._.slice(1)
  const opts = {
    output: argv.output,
    subject: argv.subject,
    warn: argv.quiet ? () => {} : console.warn
  }

  // if we don't have anything being piped in via stdin,
  // nor any GeoJSON specified as positionals... show the help
  if (process.stdin.isTTY && positionals.length === 0) {
    yargs.showHelp()
    console.error('Please provide some GeoJSON')
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
    doOperation(command, positionals, opts)
  } catch (err) {
    // if we're in a development scenario (aka this file was directly executed)
    // throw an eror that will include a stacktrace.  else, display a cleaner error.
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
      yargs.option('s', {
        alias: 'subject',
        describe: 'The subject GeoJSON object',
        type: 'string',
        requiresArg: true,
        normalize: true
      }),
    handler
  )
  .command('xor', 'Compute the xor', {}, handler)
  .demandCommand(1, 'Please specify a command')
  .option('o', {
    alias: 'output',
    describe: 'Write computed GeoJSON here',
    type: 'string',
    requiresArg: true,
    normalize: true
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
