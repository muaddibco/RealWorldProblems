# Deployment Guide: Azure Table Storage Caching

## Quick Start

### 1. Install Dependencies

```bash
cd api
npm install
cd ..
```

### 2. Update Configuration

The storage account name needs to be set. Add to your environment or `.env`:

```bash
export STORAGE_ACCOUNT_NAME=st<random>issues  # e.g., stxyz123issues
export AZURE_LOCATION=eastus
```

### 3. Deploy Infrastructure

```bash
azd up
```

This will:
- Create/update the Storage Account with Table Storage
- Create the IssuesCache table
- Set `AzureWebJobsStorage` environment variable automatically

### 4. Verify Deployment

```bash
# Check storage account exists
az storage account show -n $STORAGE_ACCOUNT_NAME -g rg-develop

# Check table exists
az storage table exists --name IssuesCache \
  --account-name $STORAGE_ACCOUNT_NAME
```

### 5. Build and Test Locally

```bash
# Build API functions
cd api
npm run build

# Run locally
npm start
```

Visit: http://localhost:7071/api/issues?limit=5

You should see response with `cacheInfo.source: "cache"` or `"github"`

## Troubleshooting

### Issue: Storage Connection Not Found

**Error**: `Storage connection string not configured`

**Solution**: 
```bash
# Verify environment variable is set
echo $AzureWebJobsStorage

# Or set explicitly in local.settings.json:
{
  "Values": {
    "AzureWebJobsStorage": "DefaultEndpointsProtocol=https;AccountName=...",
    ...
  }
}
```

### Issue: Table Not Found

**Error**: `The specified table does not exist`

**Solution**: 
- The table is created automatically on first use
- If manually deleted, restart the app or call `/api/cache/refresh`
- Check Azure Portal > Storage Account > Tables

### Issue: Cache Not Persisting

**Reason**: May be using in-memory cache only if Table Storage is unavailable

**Check logs for**:
```
"Failed to retrieve from table storage, falling back to GitHub"
```

**Solution**: Verify storage connection and permissions

## API Endpoints

### List Issues (with cache)
```
GET /api/issues?refresh=false&limit=100&status=all
```

**Query Parameters**:
- `refresh=true` - Force GitHub API fetch (bypasses cache)
- `refresh=false` - Use cache (default)
- Other filters apply normally

**Response**:
```json
{
  "ok": true,
  "issues": [...],
  "total": 42,
  "summary": {...},
  "cacheInfo": {
    "source": "cache",
    "timestamp": 1684500000000
  }
}
```

### Hard Refresh Cache
```
POST /api/cache/refresh
```

**Response**:
```json
{
  "ok": true,
  "issues": [...],
  "total": 42,
  "message": "Cache refreshed from GitHub"
}
```

## Production Considerations

### Cost
- **Storage**: ~$0.018 per GB/month (hot tier)
- **Transactions**: ~$0.005 per 10K transactions
- **Typical monthly cost**: <$2 for small deployment

### Performance Targets
- Cache hit: <100ms response time
- Cache miss: ~500ms (GitHub API call)
- Target cache hit rate: >95%

### Monitoring

Add these Application Insights queries:

```kusto
// Cache hit rate
traces
| where message contains "serving" or message contains "Cached"
| summarize HitRate=countif(message contains "serving")/count() by bin(timestamp, 1h)
```

```kusto
// Average response times
requests
| where name startswith "issues"
| extend cacheSource=tostring(customDimensions.cacheSource)
| summarize AvgDuration=avg(duration) by cacheSource, bin(timestamp, 1h)
```

## Cleanup

### Remove Cache Data
```bash
az storage table delete --name IssuesCache \
  --account-name $STORAGE_ACCOUNT_NAME \
  --account-key $(az storage account keys list -n $STORAGE_ACCOUNT_NAME -g rg-develop --query [0].value -o tsv)
```

### Remove Storage Account
```bash
az storage account delete -n $STORAGE_ACCOUNT_NAME -g rg-develop --yes
```

## Next Steps

1. ✅ Deploy and test the implementation
2. Monitor cache hit rates in Application Insights
3. Adjust TTL if needed (currently uses environment default)
4. Consider adding cache warming strategy
5. Optimize issue size/compression if needed

## Support

Check logs in:
- Azure Portal > Function App > Log Stream
- Application Insights > Performance
- Local development: `npm start` console output
