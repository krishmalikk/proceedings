import { describe, it, expect, afterEach } from 'vitest'
import { apiBase } from '../apiBase'

const ORIG = process.env.PYTHON_API_URL
afterEach(() => {
  if (ORIG === undefined) delete process.env.PYTHON_API_URL
  else process.env.PYTHON_API_URL = ORIG
})

describe('apiBase()', () => {
  it('returns a correctly-configured origin unchanged', () => {
    process.env.PYTHON_API_URL = 'https://api.example.run.app'
    expect(apiBase()).toBe('https://api.example.run.app')
  })

  it('strips a trailing slash', () => {
    process.env.PYTHON_API_URL = 'https://api.example.run.app/'
    expect(apiBase()).toBe('https://api.example.run.app')
  })

  it('strips a stray trailing "/api" — the production misconfig that 404s every call', () => {
    process.env.PYTHON_API_URL = 'https://api.example.run.app/api'
    expect(apiBase()).toBe('https://api.example.run.app')
  })

  it('strips a trailing "/api/" (slash + segment)', () => {
    process.env.PYTHON_API_URL = 'https://api.example.run.app/api/'
    expect(apiBase()).toBe('https://api.example.run.app')
  })

  it('falls back to localhost when unset', () => {
    delete process.env.PYTHON_API_URL
    expect(apiBase()).toBe('http://localhost:8000')
  })

  it('only strips a trailing "/api" segment, never a mid-path one', () => {
    process.env.PYTHON_API_URL = 'https://host.example/api/v2'
    expect(apiBase()).toBe('https://host.example/api/v2')
  })
})
