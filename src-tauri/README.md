# Desktop Build (Tauri v2)

The desktop wrapper embeds the Next.js standalone server and hosts it inside a
native webview window. On launch, `main.rs` picks a free loopback port, spawns
`node .next/standalone/server.js`, and navigates the window to
`http://127.0.0.1:<port>`.

## Local build

```bash
bun install
bunx prisma generate
bun tauri build        # Linux: deb + appimage. Windows/macOS: GitHub Actions.
```

## CI build

Push a tag like `v1.0.0` to trigger `.github/workflows/tauri.yml`, which builds
MSI (Windows), DMG (macOS) and deb (Linux) via `tauri-action` and publishes a
GitHub release.

Env vars needed in CI secrets: `TURSO_DATABASE_URL`, `GEMINI_API_KEY`.
The packaged app reads them from process environment (set in `main.rs`) so the
desktop app works on machines without `.env`.
