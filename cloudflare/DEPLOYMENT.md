# 🚀 Cloudflare Worker - Deployment Guide

## Quick Start

### Prerequisites

```bash
# Install wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Setup

```bash
cd cloudflare
npm install
```

### Environment Variables

Update `wrangler.toml` with your values:

```toml
[[r2_buckets]]
binding = "IMAGES_BUCKET"
bucket_name = "ohara-cards-images"  # Your R2 bucket name
```

For KV namespace (optional cache):

```bash
# Create KV namespace
npm run create:kv

# Copy the ID output and paste it in wrangler.toml
```

### Deploy

```bash
# Deploy to staging
npm run deploy:staging

# Test staging
curl https://your-worker-staging.workers.dev/health

# Deploy to production
npm run deploy:production
```

---

## Custom Domain Setup

### Option 1: Workers Route (Recommended for oharatcg.com)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker → Settings → Triggers
3. Add Route:
   - Route: `images.oharatcg.com/*`
   - Zone: `oharatcg.com`

4. DNS will be created automatically

### Option 2: Custom Domain (Standalone)

1. Go to Workers → your worker → Settings → Triggers
2. Add Custom Domain: `images.oharatcg.com`
3. Cloudflare handles SSL automatically

---

## Testing

### Health Check

```bash
curl https://images.oharatcg.com/health
# Should return: OK
```

### Test Image (after migration)

```bash
curl -I https://images.oharatcg.com/cards/OP01-001-medium.webp
```

Expected headers:
```
HTTP/2 200
content-type: image/webp
cache-control: public, max-age=31536000, immutable
x-cache-status: HIT
access-control-allow-origin: *
```

### Monitor Logs

```bash
npm run tail
```

---

## Performance

### Cache Strategy

- **Browser Cache**: 1 year (immutable)
- **Cloudflare Edge Cache**: 1 year
- **Hit Rate Target**: >95% after warmup

### Response Times

- **Cache HIT**: <50ms (served from nearest edge location)
- **Cache MISS**: 100-300ms (fetch from R2 + transform + cache)

### Monitoring

Cloudflare Dashboard → Workers → Analytics:
- Requests/second
- Cache hit rate
- Error rate
- P50/P95/P99 latency

---

## Costs

### Workers Pricing

**Free Plan:**
- 100,000 requests/day
- Good for development/staging

**Paid Plan** ($5/month):
- 10 million requests included
- $0.50 per additional million
- Recommended for production

### R2 Pricing

**Storage:** $0.015/GB/month
**Operations:**
- Class A (writes): $4.50 per million
- Class B (reads): $0.36 per million
**Egress:** $0 (FREE!)

**Example costs for 30,000 images (~200GB):**
- Storage: $3/month
- Workers: $5-8/month
- **Total: ~$8-11/month** vs ~$65/month with KeyCDN

---

## Troubleshooting

### Worker not accessible

```bash
# Check deployment
wrangler deployments list

# Re-deploy
npm run deploy:production
```

### Images returning 404

```bash
# Check R2 bucket binding
wrangler r2 bucket list

# Verify image exists
wrangler r2 object get ohara-cards-images cards/image-name.webp
```

### High error rate

```bash
# Check logs
npm run tail

# Look for:
# - R2 connection errors
# - Invalid image paths
# - CORS issues
```

### Cache not working

Check headers with:
```bash
curl -I https://images.oharatcg.com/cards/test.webp
```

`X-Cache-Status` should be:
- `MISS` on first request
- `HIT` on subsequent requests

---

## Updating the Worker

```bash
# Make changes to src/worker-simple.ts
# Test locally
npm run dev

# Deploy
npm run deploy:staging  # Test first
npm run deploy:production  # Then production
```

---

## Rollback

If something goes wrong:

```bash
# List deployments
wrangler deployments list

# Rollback to previous
wrangler rollback <deployment-id>
```

---

## Best Practices

1. **Always deploy to staging first**
2. **Monitor logs after deployment**
3. **Check analytics after 1 hour**
4. **Set up alerts for high error rates**
5. **Keep wrangler.toml in version control**

---

## Support

- [Cloudflare Workers Discord](https://discord.gg/cloudflaredev)
- [Community Forum](https://community.cloudflare.com/)
- [Documentation](https://developers.cloudflare.com/workers/)
