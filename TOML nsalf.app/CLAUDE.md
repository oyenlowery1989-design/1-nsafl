# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This is a **static Vercel deployment** whose sole purpose is to serve the Stellar SEP-1 `stellar.toml` file at `nsafl.com/.well-known/stellar.toml`. It makes the NSAFL token discoverable by Stellar wallets and DEXes.

## Structure

```
TOML nsalf.app/
├── .well-known/stellar.toml   ← The only meaningful file — edit this for token/org changes
├── vercel.json                ← Sets CORS + Content-Type headers for stellar.toml
├── index.html                 ← Empty shell (Vercel needs at least one file)
└── logo.png                   ← Served as nsafl.com/logo.png (referenced in toml)
```

## Deployment

Deployed to Vercel. No build step — purely static. `vercel.json` configures:
- `Access-Control-Allow-Origin: *` (required by Stellar SEP-1)
- `Content-Type: text/plain; charset=utf-8`
- `Cache-Control: public, max-age=3600`

## Editing the TOML

The `stellar.toml` follows [Stellar SEP-0001](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md). Key sections:

- **ACCOUNTS** — list of issuer public keys
- **DOCUMENTATION** — org info
- **[[CURRENCIES]]** — one block per asset; each needs `code`, `issuer`, `status`

**Issuer address:** `GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL`

Current assets: `NSAFL`, `wNSAFL`, `wUSDC`, `wUSDT`, `wXLM`, `wXRP`

Note: the TOML file currently has a bug — multiple `[[CURRENCIES]]` blocks share the same section header incorrectly (only the first `code=` per `[[CURRENCIES]]` block is valid TOML). Each asset needs its own `[[CURRENCIES]]` header.
