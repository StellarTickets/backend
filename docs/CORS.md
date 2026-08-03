# CORS

`main.ts` calls `app.enableCors({ origin: APP_URL, credentials: true })`
— only the single configured frontend origin is allowed. If the
frontend is ever served from multiple origins (staging + production),
`APP_URL` will need to become a list rather than a single string.
