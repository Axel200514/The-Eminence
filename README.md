# The Eminence - Brawl Stars Clan API

Backend serverless en **Cloudflare Pages** para consultar estadísticas y conteo de miembros del clan en tiempo real.

## Características
- **Seguridad:** API Key protegida en variables de entorno de Cloudflare.
- **Caché:** CDN Edge Cache de 5 horas (`Cache-Control: public, max-age=18000`).
- **Proxy:** Conexión a través del proxy de RoyaleAPI.

## Uso del Endpoint
```http
GET https://the-eminence.pages.dev/getClan?tag=80L9UYGQG
```
