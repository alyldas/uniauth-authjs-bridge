import { describe, expect, it } from 'vitest'
import { ProviderTrustLevel, UniAuthErrorCode } from '@alyldas/uniauth-core'
import { createInMemoryAuthKit } from '@alyldas/uniauth-core/testing'
import { mapAuthJsOAuthToAssertion } from '@alyldas/uniauth-authjs-bridge'

const now = new Date('2025-01-02T03:04:05.000Z')

async function catchError(operation: () => unknown | Promise<unknown>): Promise<unknown> {
  try {
    await operation()
  } catch (error) {
    return error
  }

  throw new Error('Expected operation to fail.')
}

describe('Auth.js bridge', () => {
  it('maps Auth.js oauth inputs into a UniAuth assertion without copying tokens', () => {
    const assertion = mapAuthJsOAuthToAssertion({
      providerId: 'google-workspace',
      account: {
        provider: 'google',
        providerAccountId: ' provider-user-1 ',
        type: 'oauth',
      },
      profile: {
        sub: 'provider-user-1',
        email: ' Person@Example.COM ',
        email_verified: 'true',
        phone_number: ' +1 555 000 1234 ',
        phone_number_verified: false,
        name: ' Person Example ',
        preferred_username: ' person ',
        picture: ' https://example.com/avatar.png ',
        locale: ' en ',
      },
      user: {
        image: ' https://example.com/fallback.png ',
      },
      trust: {
        level: ProviderTrustLevel.Trusted,
        signals: ['workspace-admin'],
      },
      metadata: {
        tenantId: 'tenant-1',
      },
    })

    expect(assertion).toEqual({
      provider: 'google-workspace',
      providerUserId: 'provider-user-1',
      email: 'Person@Example.COM',
      emailVerified: true,
      phone: '+1 555 000 1234',
      phoneVerified: false,
      displayName: 'Person Example',
      trust: {
        level: ProviderTrustLevel.Trusted,
        signals: ['workspace-admin'],
      },
      metadata: {
        frameworkProviderId: 'google',
        preferredUsername: 'person',
        pictureUrl: 'https://example.com/avatar.png',
        locale: 'en',
        tenantId: 'tenant-1',
      },
    })
    expect(assertion.metadata).not.toHaveProperty('accessToken')
    expect(assertion.metadata).not.toHaveProperty('refreshToken')
    expect(assertion.metadata).not.toHaveProperty('idToken')
  })

  it('rejects non-oauth accounts and mismatched subjects', async () => {
    await expect(
      catchError(() =>
        mapAuthJsOAuthToAssertion(
          null as unknown as Parameters<typeof mapAuthJsOAuthToAssertion>[0],
        ),
      ),
    ).resolves.toMatchObject({
      code: UniAuthErrorCode.InvalidInput,
      message: 'Auth.js bridge input is required.',
    })

    await expect(
      catchError(() =>
        mapAuthJsOAuthToAssertion({
          account: null as unknown as Parameters<typeof mapAuthJsOAuthToAssertion>[0]['account'],
        }),
      ),
    ).resolves.toMatchObject({
      code: UniAuthErrorCode.InvalidInput,
      message: 'Auth.js account is required.',
    })

    await expect(
      catchError(() =>
        mapAuthJsOAuthToAssertion({
          account: {
            provider: 'credentials',
            providerAccountId: 'user-1',
            type: 'credentials',
          },
        }),
      ),
    ).resolves.toMatchObject({
      code: UniAuthErrorCode.InvalidInput,
      message: 'Auth.js bridge only accepts oauth or oidc accounts.',
    })

    await expect(
      catchError(() =>
        mapAuthJsOAuthToAssertion({
          account: {
            provider: 'google',
            providerAccountId: 'user-1',
            type: 'oauth',
          },
          profile: {
            sub: 'user-2',
          },
        }),
      ),
    ).resolves.toMatchObject({
      code: UniAuthErrorCode.InvalidInput,
      message: 'Auth.js account providerAccountId and profile subject must match.',
    })

    await expect(
      catchError(() =>
        mapAuthJsOAuthToAssertion({
          account: {
            provider: 'google',
            providerAccountId: '   ',
          },
        }),
      ),
    ).resolves.toMatchObject({
      code: UniAuthErrorCode.InvalidInput,
      message: 'Auth.js account providerAccountId is required.',
    })
  })

  it('supports fallback fields and keeps metadata empty when nothing safe is left', () => {
    expect(
      mapAuthJsOAuthToAssertion({
        account: {
          provider: 'github',
          providerAccountId: ' github-user-1 ',
          type: 'oidc',
        },
        profile: {
          id: 'github-user-1',
          email_verified: 'not-a-boolean',
          name: '   ',
          preferred_username: '   ',
          picture: '   ',
          locale: '   ',
        },
        user: {
          email: ' GitHubUser@Example.COM ',
          emailVerified: 'false',
          name: ' GitHub User ',
          image: ' https://example.com/github.png ',
        },
      }),
    ).toEqual({
      provider: 'github',
      providerUserId: 'github-user-1',
      email: 'GitHubUser@Example.COM',
      emailVerified: false,
      displayName: 'GitHub User',
      metadata: {
        pictureUrl: 'https://example.com/github.png',
      },
    })
  })

  it('returns a minimal assertion when only the exact provider identity is available', () => {
    expect(
      mapAuthJsOAuthToAssertion({
        account: {
          provider: 'google',
          providerAccountId: 'google-user-1',
        },
      }),
    ).toEqual({
      provider: 'google',
      providerUserId: 'google-user-1',
    })
  })

  it('rejects metadata that is not a plain object', async () => {
    await expect(
      catchError(() =>
        mapAuthJsOAuthToAssertion({
          account: {
            provider: 'google',
            providerAccountId: 'user-1',
          },
          metadata: ['tenant-1'] as unknown as Record<string, unknown>,
        }),
      ),
    ).resolves.toMatchObject({
      code: UniAuthErrorCode.InvalidInput,
      message: 'Bridge metadata must be a plain object.',
    })

    await expect(
      catchError(() =>
        mapAuthJsOAuthToAssertion({
          account: {
            provider: 'google',
            providerAccountId: 'user-1',
          },
          metadata: new Date() as unknown as Record<string, unknown>,
        }),
      ),
    ).resolves.toMatchObject({
      code: UniAuthErrorCode.InvalidInput,
      message: 'Bridge metadata must be a plain object.',
    })
  })

  it('accepts metadata records without an object prototype', () => {
    const metadata = Object.assign(Object.create(null) as Record<string, unknown>, {
      tenantId: 'tenant-1',
    })

    expect(
      mapAuthJsOAuthToAssertion({
        account: {
          provider: 'google',
          providerAccountId: 'user-1',
        },
        metadata,
      }).metadata,
    ).toEqual({
      tenantId: 'tenant-1',
    })
  })

  it('feeds mapped assertions through the normal sign-in pipeline', async () => {
    const kit = createInMemoryAuthKit()

    const result = await kit.service.signIn({
      assertion: mapAuthJsOAuthToAssertion({
        account: {
          provider: 'authjs-google',
          providerAccountId: 'authjs-user-1',
          type: 'oauth',
        },
        profile: {
          sub: 'authjs-user-1',
          email: 'Bridge@Example.COM',
          email_verified: true,
          name: 'Bridge User',
        },
      }),
      now,
    })

    expect(result.identity.provider).toBe('authjs-google')
    expect(result.identity.providerUserId).toBe('authjs-user-1')
    expect(result.identity.email).toBe('bridge@example.com')
    expect(result.identity.emailVerified).toBe(true)
    expect(result.user.id).toBe(result.session.userId)
  })
})
