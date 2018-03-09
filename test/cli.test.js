/* eslint-env jest */

const { spawn } = require('child-process-promise')
const cliPath = './src/cli.js'

// Tell the child subprocess to mock out the implementation of lib.doIt.
// Note that normal mocking doesn't work as this is run as a separate process.
const childEnv = Object.assign({}, process.env, { NODE_MOCK_DOIT: true })

describe('cli', () => {
  // to the child process, it'll look like the process was run
  // from the terminal *with* something piped to it on stdin
  const optsWithStdin = {
    capture: ['stdout', 'stderr'],
    env: childEnv
  }

  // to the child process, it'll look like the process was run
  // from the terminal *without* anything piped to it on stdin
  const optsWithoutStdin = {
    capture: ['stdout', 'stderr'],
    env: childEnv,
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
    expect.assertions(2)
    return spawn(cliPath, ['union'], optsWithStdin).then(result => {
      expect(result.stderr).toEqual('')
      expect(JSON.parse(result.stdout).opts.stdout).toEqual('piped')
    })
  })

  test('OK with a positional', () => {
    expect.assertions(2)
    return spawn(cliPath, ['union', 'file'], optsWithoutStdin).then(result => {
      expect(result.stderr).toEqual('')
      expect(JSON.parse(result.stdout).positionals).toEqual(['file'])
    })
  })

  test('OK with multiple positionals', async () => {
    const result = await spawn(
      cliPath,
      ['union', 'file1', 'file2'],
      optsWithoutStdin
    )
    expect(result.stderr).toEqual('')
    expect(JSON.parse(result.stdout).positionals).toEqual(['file1', 'file2'])
  })

  test('OK for union', async () => {
    const result = await spawn(cliPath, ['union'], optsWithStdin)
    expect(result.stderr).toEqual('')
    expect(JSON.parse(result.stdout).operation).toEqual('union')
  })

  test('OK for intersection', async () => {
    const result = await spawn(cliPath, ['intersection'], optsWithStdin)
    expect(result.stderr).toEqual('')
    expect(JSON.parse(result.stdout).operation).toEqual('intersection')
  })

  test('OK for xor', async () => {
    const result = await spawn(cliPath, ['xor'], optsWithStdin)
    expect(result.stderr).toEqual('')
    expect(JSON.parse(result.stdout).operation).toEqual('xor')
  })

  test('OK with -q option', async () => {
    const result = await spawn(cliPath, ['union', '-q'], optsWithStdin)
    expect(result.stderr).toEqual('')
    expect(JSON.parse(result.stdout).opts.warn).toEqual('none')
  })

  test('OK with -o option', async () => {
    const result = await spawn(cliPath, ['union', '-o', 'file'], optsWithStdin)
    expect(result.stderr).toEqual('')
    expect(JSON.parse(result.stdout).opts.output).toEqual('file')
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

  test('OK for difference with input on stdin', async () => {
    const result = await spawn(cliPath, ['difference'], optsWithStdin)
    expect(result.stderr).toEqual('')
    expect(JSON.parse(result.stdout).operation).toEqual('difference')
  })

  test('OK for difference with input via -s ', async () => {
    const result = await spawn(
      cliPath,
      ['difference', 'file1', '-s', 'file2'],
      optsWithoutStdin
    )
    expect(result.stderr).toEqual('')
    expect(JSON.parse(result.stdout).opts.subject).toEqual('file2')
  })

  test('OK for difference with -b ', async () => {
    const result = await spawn(cliPath, ['difference', '-b'], optsWithStdin)
    expect(result.stderr).toEqual('')
    expect(JSON.parse(result.stdout).opts.bboxes).toEqual(true)
  })
})
