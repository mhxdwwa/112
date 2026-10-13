# MathLab Image Relay Worker

Cloudflare Worker for relaying images between mobile and desktop devices in the MathLab photo upload feature.

## Deployment Steps

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create KV Namespace

```bash
wrangler kv:namespace create IMAGE_KV
```

This will output something like:
```
{ binding = "IMAGE_KV", id = "abc123..." }
```

Copy the `id` value and update it in `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "IMAGE_KV"
id = "abc123..."  # Replace with your actual ID
```

### 4. Deploy Worker

```bash
wrangler deploy
```

The worker will be deployed to: `https://mathlab-image-relay.<your-subdomain>.workers.dev`

### 5. (Optional) Add Custom Route

To use a custom path like `wscls.cn/api/image-relay/`, add a route in `wrangler.toml`:

```toml
routes = [
  { pattern = "wscls.cn/api/image-relay/*", zone_name = "wscls.cn" }
```

Then update the Worker URL in `shuxuezuotu.html` to use this custom path.

## API Endpoints

- `POST /api/pair` - Generate pairing code
- `POST /api/upload` - Upload image with code
- `GET /api/check/:code` - Check for image
- `DELETE /api/clear/:code` - Clear image after receiving

## Notes

- Images auto-expire after 30 minutes (KV TTL)
- Free tier: 100,000 requests/day, 1GB storage
- Images are stored as base64 strings in KV
