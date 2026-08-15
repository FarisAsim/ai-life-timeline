/**
 * Resolves the active local account for an incoming API request.
 * The client sends `X-Account-Id` with the active device-level account id;
 * the server looks it up and falls back to the legacy demo user when absent.
 */
import { getDemoUser } from '@/lib/services/demo-user'
import type { NextRequest } from 'next/server'

export function activeAccountId(request?: NextRequest): string | undefined {
  if (!request) return undefined
  const id = request.headers.get('x-account-id')
  return id && id.length > 10 ? id : undefined
}

export async function resolveUser(request?: NextRequest) {
  return getDemoUser(activeAccountId(request))
}
