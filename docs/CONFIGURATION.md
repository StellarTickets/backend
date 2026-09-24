# Configuration

All environment variables are validated at boot by
`src/config/env.validation.ts` — the app refuses to start rather than
run with a missing or malformed value. See
[`.env.example`](../.env.example) for the full list and
[`docs/AUTHENTICATION.md`](AUTHENTICATION.md) /
[`docs/NON_CUSTODIAL.md`](NON_CUSTODIAL.md) for what `JWT_SECRET` and
`PLATFORM_SIGNER_SECRET` are actually used for.

## Checks beyond per-variable format

Besides each variable's own format, `validate()` refuses to start when:

- **`JWT_SECRET` is weak.** Every environment requires at least 32
  characters. With `NODE_ENV=production` the secret must also contain at
  least 10 distinct characters and must not look like a placeholder: after
  lower-casing and removing punctuation, it may not contain `changeme`,
  `replaceme`, `yoursecret`, `jwtsecret`, `secretkey`, `mysecret`,
  `placeholder`, `example`, `default`, `insecure`, `donotuse` or `password`.
  Generate one with `openssl rand -base64 48`. The same rules apply to a
  secret loaded through a [secret provider](#secret-providers).
- **`SOROBAN_RPC_URL` and `STELLAR_NETWORK` disagree.** The network
  passphrase that transactions are signed with comes from `STELLAR_NETWORK`.
  The app can't reach the RPC at boot, so it infers the RPC's network from
  its URL instead: a host or path segment named `testnet`, `futurenet`,
  `mainnet` or `pubnet` (for example `soroban-testnet.stellar.org` or
  `rpc-futurenet.stellar.org`). If that network differs from
  `STELLAR_NETWORK`, startup fails. URLs that name no network, or more than
  one, pass this check; that covers self-hosted or local nodes such as
  `http://localhost:8000/soroban/rpc`. `SOROBAN_RPC_URL` must be an `http`
  or `https` URL.

## API path prefix

Set `API_PREFIX` (for example `api` or `api/v1`) to serve every route under
that path when the API is hosted behind a reverse proxy at a sub-path. With
`API_PREFIX=api/v1`, `POST /auth/login` becomes `POST /api/v1/auth/login`.
`GET /health` stays at the root so load-balancer and orchestrator probes
don't have to change. Leave it unset or empty to keep the current root
paths. Leading and trailing slashes are ignored. Only URL-safe path segments
are accepted, and `.` or `..` segments are rejected.

## Secret providers

`JWT_SECRET` is read through a pluggable `SecretProvider`
(`src/config/secrets/secret-provider.ts`), chosen with `SECRETS_PROVIDER`:

| `SECRETS_PROVIDER` | Reads `JWT_SECRET` from | Required variables |
|---|---|---|
| `env` (default) | the `JWT_SECRET` environment variable | `JWT_SECRET` |
| `file` | the file at `JWT_SECRET_FILE`, with surrounding whitespace trimmed | `JWT_SECRET_FILE` |
| `custom` | the provider passed to `SecretsModule.forRoot({ provider })` | — |

`file` works with Docker and Kubernetes secrets, and with secrets-manager
sidecars that mount values as files, such as Vault Agent or the AWS and GCP
Secrets Store CSI drivers. With `file`, the secret never has to be in the
process environment.

To read the secret straight from a secrets manager instead, implement the
interface and register the class in `src/app.module.ts`:

```ts
@Injectable()
export class VaultSecretProvider implements SecretProvider {
  readonly name = 'vault';

  constructor(private readonly config: ConfigService) {}

  async getSecret(key: string): Promise<string | undefined> {
    // Fetch `key` from your secrets manager here.
  }
}

// app.module.ts
SecretsModule.forRoot({ provider: VaultSecretProvider }),
```

Then start the app with `SECRETS_PROVIDER=custom`. The secret is resolved
once at boot (`src/auth/jwt-secret.module.ts`) and is used both to sign
tokens (`JwtModule`) and to verify them (`JwtStrategy`). If the secret is
missing, or fails the strength rules above, the app doesn't start. Rotating
the secret requires a restart, and a restart invalidates tokens already
issued.
