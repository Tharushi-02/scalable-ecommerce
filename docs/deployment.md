# Deployment

## Quick public demo (Cloudflare quick tunnel, no account)
1. `$env:TRUST_PROXY='2'; docker compose up -d`   (2 proxies: Cloudflare + Nginx)
2. `docker run --rm --network ecom-stack_default cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://client:80`
3. Open the printed https://….trycloudflare.com link. It works while the window stays open (new URL each time).
4. Verify: `$env:BASE_URL='<link>'; npm run test:api` in server/ → 18/18.
5. Stop: Ctrl+C, then `Remove-Item Env:TRUST_PROXY; docker compose up -d`.

## Permanent server (planned): Azure for Students VM
Ubuntu 24.04 x64, Standard_B2s, images pulled from Docker Hub (built by CI), Caddy for HTTPS.