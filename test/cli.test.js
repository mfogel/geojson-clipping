/* eslint-env jest */

const { spawn } = require('child-process-promise')
const cliPath = './src/cli.js'

// Note that the doIt() from ../src/lib.js is replaced with a null
// op when ./src/cli.js is ran in a child process of the node test runner
// Noted in ./src/cli.js as well.

describe('cli', () => {
  // to the child process, it'll look like the process was run
  // from the terminal *with* something piped to it on stdin
  const optsWithStdin = {
    capture: ['stdout', 'stderr']
  }

  // to the child process, it'll look like the process was run
  // from the terminal *without* anything piped to it on stdin
  const optsWithoutStdin = {
    capture: ['stdout', 'stderr'],
    stdio: ['inherit', 'pipe', 'pipe']
  }

  test('help shown with no command', () => {
    expect.assertions(2)
    return spawn(cliPath, [], optsWithoutStdin).catch(err => {
      expect(err.stderr.includes('cli.js <command>')).toBeTruthy()
      expect(err.stderr.includes('Please specify a command')).toBeTruthy()
    })
  })

  test('help shown with unrecognized command', () => {
    expect.assertions(2)
    return spawn(cliPath, ['nope'], optsWithoutStdin).catch(err => {
      expect(err.stderr.includes('cli.js union')).toBeTruthy()
      expect(err.stderr.includes('Unknown argument')).toBeTruthy()
    })
  })

  test('help shown with no positional nor stdin', () => {
    expect.assertions(2)
    return spawn(cliPath, ['union'], optsWithoutStdin).catch(err => {
      expect(err.stderr.includes('cli.js union')).toBeTruthy()
      expect(err.stderr.includes('Please provide some GeoJSON')).toBeTruthy()
    })
  })

  test('OK with some stdin', () => {
    expect.assertions(1)
    return spawn(cliPath, ['union'], optsWithStdin).then(result => {
      expect(result.stderr).toEqual('')
    })
  })

  test('OK with a positional', () => {
    expect.assertions(1)
    return spawn(cliPath, ['union', 'file'], optsWithoutStdin).then(result => {
      expect(result.stderr).toEqual('')
    })
  })

  test('OK with multiple positionals', () => {
    expect.assertions(1)
    return spawn(
      cliPath,
      ['union', 'file1', 'file2'],
      optsWithoutStdin
    ).then(result => {
      expect(result.stderr).toEqual('')
    })
  })

  test('OK for intersection', () => {
    expect.assertions(1)
    return spawn(cliPath, ['intersection'], optsWithStdin).then(result => {
      expect(result.stderr).toEqual('')
    })
  })

  test('OK for xor', () => {
    expect.assertions(1)
    return spawn(cliPath, ['xor'], optsWithStdin).then(result => {
      expect(result.stderr).toEqual('')
    })
  })

  test('OK with -o option', () => {
    expect.assertions(1)
    return spawn(
      cliPath,
      ['union', '-o', 'file'],
      optsWithStdin
    ).then(result => {
      expect(result.stderr).toEqual('')
    })
  })

  test('help shown if difference() does not receive -s or input on stdin', () => {
    expect.assertions(2)
    return spawn(
      cliPath,
      ['difference', 'file'],
      optsWithoutStdin
    ).catch(err => {
      expect(err.stderr.includes('cli.js difference')).toBeTruthy()
      expect(err.stderr.includes('difference requires either')).toBeTruthy()
    })
  })

  test('OK for difference with input on stdin', () => {
    expect.assertions(1)
    return spawn(cliPath, ['difference'], optsWithStdin).then(result => {
      expect(result.stderr).toEqual('')
    })
  })

  test('OK for difference with input via -s ', () => {
    expect.assertions(1)
    return spawn(
      cliPath,
      ['difference', 'file1', '-s', 'file2'],
      optsWithoutStdin
    ).then(result => {
      expect(result.stderr).toEqual('')
    })
  })
})
