# Bamakor Dashboard

A comprehensive ticket management system for Bamakor projects with WhatsApp integration, worker assignment, and real-time notifications.

## Overview

The Bamakor Dashboard is a full-stack application for managing construction and maintenance tickets. It supports:

- **Web Form Integration**: Report issues directly from web forms
- **WhatsApp Integration**: Create tickets via WhatsApp with QR code scanning
- **Worker Assignment**: Assign tickets to team members and notify via WhatsApp
- **Image Attachments**: Support for photos and document uploads
- **Audit Logging**: Complete activity tracking for compliance
- **Project Management**: Organize tickets by project with customizable workflows

## Tech Stack

- **Frontend**: Next.js 14+ (React, TypeScript)
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (file attachments)
- **External APIs**: WhatsApp Business API
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account with database
- WhatsApp Business account with API access

### Environment Setup

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd bamakor-dashboard
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create `.env.local`:
   ```
   # Supabase (public - OK in browser)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

   # Supabase (secret - server-side only)
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # WhatsApp
   WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
   WHATSAPP_ACCESS_TOKEN=your-access-token
   WHATSAPP_VERIFY_TOKEN=your-verify-token
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

### Database Setup

Tables required (auto-created by Supabase migrations):

- `projects` - Project definitions
- `tickets` - Main ticket records
- `workers` - Team member information
- `sessions` - WhatsApp session tracking
- `ticket_logs` - Audit trail
- `ticket_attachments` - File metadata
- `pending_selections` - Multi-match state

## API Documentation

### Create Ticket

**POST** `/api/create-ticket`

Supports two modes:

**Web Form Mode** (project_code provided):
```json
{
  "project_code": "BMK001",
  "description": "Broken window in lobby",
  "reporter_name": "John Doe",
  "source": "web_form"
}
```

**WhatsApp Mode** (phone + message):
```json
{
  "phone": "+1234567890",
  "message": "START_BMK001",
  "description": "Broken window"
}
```

**Response**:
```json
{
  "success": true,
  "ticket": {
    "id": "uuid",
    "ticket_number": "T-001",
    "status": "NEW"
  }
}
```

### Assign Ticket

**POST** `/api/assign-ticket`

```json
{
  "ticket_id": "uuid",
  "worker_id": "uuid"
}
```

Sends WhatsApp notification to assigned worker.

### Close Ticket

**POST** `/api/close-ticket`

```json
{
  "ticket_id": "uuid"
}
```

Marks ticket as closed and clears active sessions.

### WhatsApp Webhook

**POST** `/api/webhook/whatsapp`

Receives incoming WhatsApp messages, handles:
- QR code scanning (START_PROJECT_CODE)
- Ticket creation flow
- Image attachments
- Follow-up messages

## Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Quality Checks
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript type checking

# Formatting (optional)
npm run format           # Format with Prettier
```

## Error Handling

### Robust Error Handling

All API routes implement:
- Input validation with explicit error messages
- Database error handling with context logging
- External service graceful degradation (WhatsApp)
- Environment configuration validation
- Development vs. production error details

### Error Response Format

```json
{
  "error": "User-friendly error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T12:00:00Z",
  "details": "Detailed error (development only)"
}
```

## Logging

### Log Format

The application uses emoji-prefixed logging for clarity:

- ✅ Success operations
- ❌ Errors
- ⚠️ Warnings (non-blocking failures)
- ℹ️ Info
- 🔄 Processing states

Example:
```
✅ Session created: abc123
❌ Failed to send WhatsApp notification
⚠️ Image upload failed but ticket created
```

## Production Deployment

### Quick Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

Detailed instructions: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### Production Checklist

Before deploying to production, verify:
- All environment variables set in Vercel
- WhatsApp webhook URL configured
- Database backups enabled
- Error monitoring setup (recommended)

See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)

## Project Structure

```
app/
  ├── api/                 # API routes
  │   ├── assign-ticket/
  │   ├── close-ticket/
  │   ├── create-ticket/
  │   └── webhook/whatsapp/
  ├── page.tsx            # Dashboard UI
  └── layout.tsx          # Layout wrapper

lib/
  ├── supabase.ts         # Client Supabase instance
  ├── supabase-admin.ts   # Server Supabase admin
  ├── whatsapp-send.ts    # WhatsApp send utilities
  ├── whatsapp-parser.ts  # WhatsApp parse utilities
  ├── api-error-handler.ts # Error handling utilities
  └── env-validation.ts   # Environment validation

public/                   # Static assets
```

## Security

### Secrets Management

- Never commit `.env.local` to repository
- Use Vercel environment variables for secrets
- Service role key only on server-side
- Anon key safe for browser (public)

### Database Security

- Row-level security (RLS) enforced
- Authentication required for data access
- Audit logging for compliance
- Foreign key constraints

### API Security

- Input validation on all endpoints
- No sensitive data in error details (production)
- HTTPS enforced (Vercel automatic)

## Monitoring & Maintenance

### Recommended Tools

- **Error Tracking**: Sentry, LogRocket
- **Analytics**: Vercel Analytics, Mixpanel
- **Uptime Monitoring**: Uptime.com, StatusCake
- **Database Monitoring**: Supabase dashboard

### Regular Tasks

- Weekly: Review error logs
- Monthly: Check database performance
- Quarterly: Update dependencies

## Troubleshooting

### Common Issues

**WhatsApp integration not working**
- Verify webhook URL in WhatsApp dashboard
- Check verify token matches exactly
- View WhatsApp Business logs

**Database connection errors**
- Verify environment variables
- Check Supabase project status
- Review RLS policies

**Build errors**
- Run `npm install` to update dependencies
- Check `npm run type-check` for TS errors
- Review build logs in Vercel dashboard

More troubleshooting: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#troubleshooting)

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## Support

For issues or questions:
- Check existing GitHub issues
- Review deployment guide
- Check Vercel logs
- Contact Bamakor team

## License

[Add appropriate license]

## References

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Supabase Documentation](https://supabase.com/docs)
- [WhatsApp Business API](https://www.whatsapp.com/business/developers)
- [Vercel Documentation](https://vercel.com/docs)

