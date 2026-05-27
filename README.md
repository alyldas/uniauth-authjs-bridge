# UniAuth Auth.js Bridge

[![GitHub Packages](https://img.shields.io/static/v1?label=GitHub%20Packages&message=%40alyldas%2Funiauth-authjs-bridge&color=24292f&logo=github)](https://github.com/users/alyldas/packages/npm/package/uniauth-authjs-bridge)

`@alyldas/uniauth-authjs-bridge` maps Auth.js OAuth/OIDC account and profile data into a UniAuth
`ProviderIdentityAssertion`.

## Runtime Boundary

This package does not own Auth.js setup, routes, callbacks, cookies, framework sessions, token
storage, token refresh, or provider SDK runtime. Use it only after Auth.js has already validated the
provider response.

## Install

Configure the GitHub Packages registry for the package scope before installing:

```ini
@alyldas:registry=https://npm.pkg.github.com
```

GitHub Packages can require authentication for package reads. Use a token with `read:packages` in local npm config or CI secrets; do not commit tokens.

```bash
npm install @alyldas/uniauth-core @alyldas/uniauth-authjs-bridge
```

## Usage

```ts
import { mapAuthJsOAuthToAssertion } from '@alyldas/uniauth-authjs-bridge'

const assertion = mapAuthJsOAuthToAssertion({
  providerId: 'google-workspace',
  account: {
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    type: account.type,
  },
  profile: profile
    ? {
        sub: profile.sub,
        id: profile.id,
        name: profile.name,
        email: profile.email,
        email_verified: profile.email_verified,
        phone_number: profile.phone_number,
        phone_number_verified: profile.phone_number_verified,
        preferred_username: profile.preferred_username,
        picture: profile.picture,
        locale: profile.locale,
      }
    : undefined,
  user: user
    ? {
        name: user.name ?? undefined,
        email: user.email ?? undefined,
        image: user.image ?? undefined,
      }
    : undefined,
  metadata: {
    tenantId,
  },
})

await auth.public.provider.signIn({ assertion })
```

`providerAccountId` is treated as the exact provider identity key. If the profile subject disagrees
with it, the helper rejects the input.

Pass `providerId` when the UniAuth provider namespace should differ from the Auth.js provider id.
The original Auth.js provider id is then kept as `metadata.frameworkProviderId`.

## Security Notes

- Do not pass raw Auth.js account, profile, token, request, or session objects as metadata.
- Access tokens, refresh tokens, and ID tokens are never copied by this bridge.
- Token storage remains application-owned.
- UniAuth policy invariants still apply after mapping.

## Local Checks

```bash
npm run check
```
