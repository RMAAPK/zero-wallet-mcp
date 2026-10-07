# zero-wallet-mcp

> **Zero-Knowledge, Sovereign Financial MCP Infrastructure on Polygon USDT.**

## Architecture Overview

1. **Zero-Knowledge Vault**: Master passwords never leave the user's mind or browser. Key derivation uses PBKDF2/Argon2id and AES-256-GCM authenticated encryption.
2. **Strict RLS & AAL2**: Supabase stores only client-encrypted ciphertext blobs. Row Level Security explicitly requires Authenticator Assurance Level 2 (`aal2` 2FA/TOTP).
3. **Model Context Protocol (MCP)**: Programmatic financial operations on Polygon USDT with sub-cent gas fees, hard spend rate limits, and ephemeral in-memory transaction signing.
4. **Zero-Liability Philosophy**: No backdoors, no password recovery emails, no central override. If you forget your password, your funds are permanently unrecoverable.

## Repository Layout

```text
zero-wallet-mcp/
├── packages/
│   └── crypto/              # WebCrypto client-side derivation & AES-GCM engine
├── supabase/
│   └── migrations/          # Postgres schemas, RLS policies, and pg_net webhooks
├── apps/
│   ├── mcp-server/          # Model Context Protocol daemon for Polygon USDT
│   └── web-vault/           # Minimal zero-knowledge vault client UI
└── README.md
```

## Security & Secrets
- Never commit `.env` or service role keys.
- Open-source frontend and contracts; private production keys.
