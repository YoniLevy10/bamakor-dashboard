# Bamakor Dashboard

A ticket management system for construction and maintenance projects with WhatsApp integration, worker assignment, and real-time updates.

## What It Does

Bamakor Dashboard enables field teams to report issues and track their resolution:

- **WhatsApp Entry Point**: Users send `START_[PROJECT_CODE]` to initiate ticket creation
- **Web Dashboard**: Managers view, filter, assign, and close tickets
- **Project Management**: Define projects and assign workers
- **Ticket Attachments**: Support for images/documents with signed URL access
- **Real-time Updates**: Live ticket list synced via Supabase subscriptions
- **Worker Management**: Assign field workers, track assignments, notify via WhatsApp
- **Audit Trail**: Complete log of all ticket status changes

## Tech Stack

- **Frontend**: Next.js 16 (React 19, TypeScript, inline CSS)
- **Backend**: Next.js API Routes (serverless, TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (file attachments)
- **Messaging**: WhatsApp Business API (session-based)
- **Deployment**: Vercel (Next.js optimized)

## Key Pages & Routes

### Dashboard (`/`)
- KPI summary (Total, Open, Assigned, Closed)
- Filter tickets by status and project
- Quick access to QR code management
- Mobile-friendly card layout for narrow viewports

### Tickets (`/tickets`)
- Full ticket management interface
- Advanced filtering (status, priority, project, worker)
- Create new tickets with project, description, reporter info
- Inline worker assignment and status updates
- Detail drawer with attachments, history, and metadata

### Projects (`/projects`)
- CRUD operations for project definitions
- Project codes (e.g., BMK001, BMK002)
- Project names and addresses
- Project activation/deactivation

### Workers (`/workers`)
- Worker directory management
- Phone and email validation
- Worker activation/deactivation
- View tickets assigned to each worker

### QR Codes (`/qr`)
- Generate WhatsApp links for each project
- Copy WhatsApp start codes (`START_[PROJECT_CODE]`)
- QR code generation for easy project access

## Core Architecture

### Frontend Features
- **Real-time Updates**: Supabase subscriptions for live ticket changes
- **Mobile-First**: Responsive design for mobile field workers
- **Type Safety**: Full TypeScript throughout
- **Error Handling**: User-friendly toast notifications with fallback to error toasts
- **Loading States**: All async operations disable buttons and show progress

### Backend API Routes
- `POST /api/create-ticket` - Create from WhatsApp or web form
- `POST /api/assign-ticket` - Assign worker to ticket
- `POST /api/update-ticket` - Update priority/status
- `POST /api/close-ticket` - Mark ticket as resolved
- `POST /api/webhook/whatsapp` - WhatsApp webhook receiver

### WhatsApp Flow
1. User sends `START_[PROJECT_CODE]` to WhatsApp number
2. Webhook receives message, creates/activates session
3. System creates ticket with phone number and project
4. User can message additional details or attach images
5. Worker receives assignment notification via WhatsApp
6. Status updates sent to reporter as confirmations

## Setup Instructions

### Prerequisites
- Node.js 18+
- Supabase account (PostgreSQL database + Storage)
- WhatsApp Business API access (Meta Business account required)

### Installation

1. **Clone and Install**
```bash
git clone <repository-url>
cd bamakor-dashboard
npm install
```

2. **Environment Variables** (`.env.local`)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_ACCESS_TOKEN=your-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
```

3. **Database Tables**
Required tables (create in Supabase):
- `projects` (id, name, project_code, address, created_at)
- `tickets` (id, ticket_number, project_id, description, status, assigned_worker_id, created_at, closed_at)
- `workers` (id, full_name, phone, email, role, is_active, created_at)
- `sessions` (id, phone_number, project_id, active_ticket_id, is_active, last_activity_at)
- `ticket_logs` (id, ticket_id, action_type, old_value, new_value, performed_by, created_at)
- `ticket_attachments` (id, ticket_id, file_name, file_url, mime_type, created_at)
- `pending_selections` (id, phone_number, option_text, expires_at)

4. **Run Development**
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000)

## Current Status

### ✅ Implemented & Working
- Type safety: Full TypeScript, no `any` types
- Error handling: All async operations wrapped with toast notifications
- Loading states: Buttons disable during operations, show progress text
- Mobile support: Responsive layout for all pages
- Real-time updates: Live ticket list via Supabase subscriptions
- Dashboard: KPI cards, project carousel, ticket filtering
- Tickets page: Advanced filtering, worker assignment, drawer detail view
- WhatsApp integration: Session management, ticket creation, image attachments
- Worker notifications: Assignment confirmations via WhatsApp
- Audit trail: Complete ticket history logging

### ✅ Mobile Flow Status
**FIXED**: Dashboard "New Ticket" button now works on mobile (removed modal overlay blocking issue)
- Dashboard mobile view: KPI cards (2x2 grid), ticket cards
- Tickets mobile view: Full-width card list with quick assign/close buttons
- Both pages now have fully functional forms on mobile (< 900px)

### 🔍 Known Limitations

**WhatsApp Messaging Window**
- Free-form text messages only work within 24 hours of user's last message
- After 24 hours: System automatically falls back to pre-approved template messages
- This is WhatsApp's intentional API policy, not a system bug
- Users must respond to re-engage the 24-hour window

**Database**
- No automated cleanup jobs (pending selections expire but aren't auto-deleted)
- No database constraints (UNIQUE, NOT NULL) enforced at schema level
- No Row Level Security (RLS) policies configured

**Client-Side Limitations**
- No retry logic for failed network requests
- No request deduplication at server level
- No rate limiting on API endpoints
- ESLint warnings for Next.js Image optimization (optional)
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

## Development

### Scripts
```bash
npm run dev       # Start development server on localhost:3000
npm run build     # Build for production
npm start         # Start production server

npm run lint      # Run ESLint checks
```

### Project Structure
```
app/
  ├── page.tsx                    # Dashboard
  ├── tickets/page.tsx            # Tickets list & management
  ├── projects/page.tsx           # Project CRUD
  ├── workers/page.tsx            # Worker management
  ├── qr/page.tsx                 # QR code generator
  ├── summary/page.tsx            # Summary reports
  ├── api/                        # Backend API routes
  │   ├── create-ticket/
  │   ├── assign-ticket/
  │   ├── close-ticket/
  │   ├── update-ticket/
  │   └── webhook/whatsapp/
  └── components/                 # Reusable components
      ├── ToastContainer.tsx
      └── LoadingButton.tsx

lib/
  ├── supabase.ts                 # Client-side Supabase
  ├── supabase-admin.ts           # Admin Supabase (server)
  ├── error-handler.ts            # Error handling & toasts
  ├── validators.ts               # Input validation
  ├── whatsapp-send.ts            # WhatsApp message sending
  ├── whatsapp-parser.ts          # Parse incoming messages
  ├── whatsapp-media.ts           # Handle media downloads
  ├── logging.ts                  # Logging utility
  └── retry-logic.ts              # Retry mechanism
```

### Building & Deploying

**Development:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
npm start
```

**Deployment to Vercel:**
1. Connect GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Set WhatsApp webhook URL: `https://[your-domain].vercel.app/api/webhook/whatsapp`
4. Deploy
## Troubleshooting

### Common Issues

**"WhatsApp message send failed"**
- Check access token hasn't expired
- Verify phone number format (include country code)
- Ensure template has been approved (if using templates)

**"Session not found"**
- User may have started a new session with a different project
- Database session record may have been deleted
- Create a new ticket by sending START code again

**"Attachment upload failed"**
- File size may exceed limit (check Supabase Storage settings)
- Network timeout - retry the operation
- Storage bucket permissions issue

**"Mobile button not working"**
- Ensure viewport width < 900px for mobile view
- Check browser console for JavaScript errors
- Clear browser cache and reload

## Performance Notes

- Images lazy-loaded with signed URLs
- Real-time updates via Supabase broadcast
- Ticket list paginated for large datasets (frontend only - no API pagination)
- Modal rendering optimized to avoid unnecessary re-renders

- Weekly: Review error logs
## License

MIT License - See LICENSE file for details

## Contact

For questions or support:
- Check GitHub issues
- Review code comments for implementation details
- Consult Supabase and WhatsApp API documentation