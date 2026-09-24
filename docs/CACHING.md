# HTTP caching

Public event listings returned by `GET /events` include:

```
Cache-Control: public, max-age=60, s-maxage=300
```

Browsers may reuse the response for 60 seconds. Shared caches and CDNs may reuse it for up to 300 seconds.
Authenticated organization event endpoints are not cached by this policy.