# Cura Health frontend

React 19 and Vite 8. The backend is the separate Cura API, reached through a same-origin `/api` proxy. Direct browser calls fail: the API sends no CORS headers for other origins, and its refresh cookie is `SameSite=Strict`.

## Who signs up where

Patients sign up and log in here. Doctors sign up on Cura Dashboard, and this site sends them there. Set `VITE_DASHBOARD_URL` if the Dashboard is not at `https://cura-web-qvfx.onrender.com`.

## Develop

Requires Node 22.

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run lint
```

Vite proxies `/api` to `https://cura-api-otxn.onrender.com`. Set `API_PROXY_URL` to use another API. Test login in Chrome: other browsers may refuse Secure cookies on localhost.

## Deploy on Render

Deploy as a Static Site:

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |

Add these rewrite rules, in this order:

| Source | Destination | Action |
| --- | --- | --- |
| `/api/*` | `https://cura-api-otxn.onrender.com/api/*` | Rewrite |
| `/*` | `/index.html` | Rewrite |
