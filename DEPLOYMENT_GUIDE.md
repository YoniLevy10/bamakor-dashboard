# Deployment Guide

This guide covers deploying the Bamakor Dashboard to production on Vercel.

## Prerequisites

1. **GitHub Account** - Repository is hosted on GitHub
2. **Vercel Account** - Free tier available at vercel.com
3. **Supabase Project** - Database and API
4. **WhatsApp Business Account** - With API access
5. **Required Credentials**:
   - Supabase URL and API keys
   - WhatsApp phone number ID, access token, and verify token

## Quick Start: Vercel Deployment

### Step 1: Prepare Repository

Ensure your repository is clean and all tests pass:

```bash
# Install dependencies
npm install

# Run build to verify
npm run build

# Check for errors
npm run lint
npm run type-check
```

### Step 2: Import Project to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub account
3. Click "Add New" → "Project"
4. Select your GitHub repository
5. Click "Import"

### Step 3: Configure Environment Variables

In Vercel project settings, add these environment variables:

**Public Variables** (OK to expose):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Secret Variables** (Server-side only):
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
```

**Steps:**
1. Go to Project Settings → Environment Variables
2. Add each variable with appropriate type (not secret vs. secret)
3. Make sure to add to "Production" environment
4. Optional: add to "Preview" for testing

### Step 4: Configure Build Settings

Vercel should auto-detect Next.js settings, but verify:

- **Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Node version**: 18+ recommended

### Step 5: Deploy

#### Option A: Automatic Deployment
Once configured, every push to `main` branch automatically deploys to production.

#### Option B: Manual Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Step 6: Configure WhatsApp Webhook

After deployment, update WhatsApp webhook URL:

1. Go to your WhatsApp Business dashboard
2. Find Webhook settings
3. Update webhook URL to:
   ```
   https://your-domain.vercel.app/api/webhook/whatsapp
   ```
4. Verify token: Use your `WHATSAPP_VERIFY_TOKEN`
5. Subscribe to messages, message_status webhooks

### Step 7: Verify Deployment

1. Check Vercel deployment status
2. Visit your domain - should show dashboard
3. Test API endpoints:
   ```bash
   # Create a ticket
   curl -X POST https://your-domain.vercel.app/api/create-ticket \
     -H "Content-Type: application/json" \
     -d '{
       "phone": "+1234567890",
       "message": "START_BMK001",
       "description": "Test ticket"
     }'
   ```

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**
- Ensure all dependencies are in `package.json`
- Delete `node_modules` locally and run `npm install`
- Push to trigger Vercel rebuild

**Error: "TypeScript errors"**
- Run `npm run type-check` locally
- Fix all TS errors before pushing
- Check `.ts`, `.tsx` files for issues

### Environment Variables Not Working

- Verify variables in Vercel dashboard
- Check "Production" environment has all variables
- Redeploy after adding variables
- Check variable names exactly match code

### WhatsApp Integration Not Working

1. Verify webhook URL in WhatsApp dashboard matches Vercel domain
2. Check `WHATSAPP_VERIFY_TOKEN` matches exactly
3. View logs in WhatsApp Business dashboard
4. Test webhook manually:
   ```bash
   curl https://your-domain.vercel.app/api/webhook/whatsapp \
     -H "hub.mode=subscribe" \
     -H "hub.verify_token=YOUR_TOKEN_HERE" \
     -H "hub.challenge=test_challenge"
   ```

### Database Connection Issues

1. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
2. Check `SUPABASE_SERVICE_ROLE_KEY` is valid
3. Ensure Supabase project is active
4. Check database tables exist
5. Verify RLS policies allow service role

## Monitoring & Debugging

### View Deployment Logs

```bash
# Using Vercel CLI
vercel logs

# Or in Vercel dashboard
# Project → Deployments → Select deployment → View logs
```

### View Application Logs

The app uses structured logging with emoji indicators:
- ✅ Success
- ❌ Error
- ⚠️ Warning
- ℹ️ Info

Check browser console for client-side logs.

### View Function Logs

Vercel Serverless Functions logs appear in:
1. Vercel Dashboard → Logs
2. See real-time logs for API requests

## Security Considerations

### Secrets Management

- All authentication tokens should be in Environment Variables
- Never commit `.env.local` or secrets to repository
- Use "Secret" type in Vercel for sensitive variables
- Rotate tokens periodically

### CORS & Security Headers

The app is configured for:
- Same-origin requests from your domain
- Standard security headers
- HTTPS enforcement (automatic on Vercel)

### Database Security

- Supabase RLS policies enforce access control
- Service role key only used server-side
- Anon key safe for client-side signed requests
- Never expose service role key to client

## Performance Optimization

### Vercel Functions Optimization

1. **Cold Starts**: Functions stay warm with frequent use
2. **Memory**: Default 1024MB is sufficient
3. **Timeout**: Default 60s, increase if needed for heavy operations

### Monitoring Performance

- Use Vercel Analytics for page load metrics
- Monitor API response times in logs
- Check database query performance in Supabase dashboard

## Database Backups & Recovery

### Supabase Backups

1. Backups are automatic (free tier: 7 days retention)
2. Go to Supabase Dashboard → Backups
3. Download backup if needed
4. Restore: Contact Supabase support

### Manual Backup Procedure

```bash
# Export data from Supabase
pg_dump "postgresql://[user]:[password]@[host]:[port]/[database]" > backup.sql
```

## Scaling Considerations

### When Usage Grows

- Supabase: Check database performance metrics
- Vercel: Auto-scales serverless functions
- WhatsApp: May need higher rate limits
- Storage: Monitor ticket-attachments bucket usage

### Optimization Checklist

- [ ] Enable database query caching
- [ ] Optimize image sizes for attachments
- [ ] Consider CDN for static assets
- [ ] Implement API caching where appropriate
- [ ] Review and optimize database indexes

## Maintenance Schedule

### Daily (Automated)

- Continuous backups (Supabase)
- Error monitoring

### Weekly

- Review error logs for patterns
- Check API performance metrics
- Spot check a few features

### Monthly

- Review and update dependencies
- Check security advisories
- Test disaster recovery procedure
- Review database performance

### Quarterly

- Major dependency updates
- Performance optimization review
- Security audit

## Rollback Procedure

If critical issues occur:

1. **Immediate**: Revert to previous working deployment
   ```bash
   vercel rollback --prod
   ```

2. **Check Logs**: Understand what went wrong
   - Vercel deployment logs
   - Application runtime logs
   - Database error logs

3. **Fix Issue**: Make fixes locally, test thoroughly

4. **Redeploy**: Push to main branch or manual deploy

5. **Monitor**: Watch logs closely after redeployment

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **WhatsApp API Docs**: https://www.whatsapp.com/business/developers
