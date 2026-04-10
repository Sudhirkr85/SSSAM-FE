# Institute Enquiry Management System (IEMS)

A complete frontend CRM system for managing institute enquiries, admissions, and payments.

## Tech Stack

- **HTML5** - Structure
- **Tailwind CSS** - Styling
- **Vanilla JavaScript** - Functionality (No frameworks)
- **Axios** - HTTP client for API calls

## Project Structure

```
frontend_crm/
├── index.html              # Login page
├── dashboard.html          # Dashboard with stats
├── enquiries.html          # Enquiry list with filters
├── enquiry-detail.html     # Enquiry detail & management
├── admissions.html         # Admissions list & management
├── payments.html           # Payments & receipts
├── reports.html            # Admin reports & analytics
├── css/
│   └── styles.css          # Custom styles & animations
├── js/
│   ├── api.js              # API configuration & endpoints
│   ├── auth.js             # Authentication module
│   ├── ui.js               # UI utilities & helpers
│   ├── dashboard.js        # Dashboard functionality
│   ├── enquiry.js          # Enquiry management
│   ├── admission.js        # Admission management
│   ├── payment.js          # Payment processing
│   └── reports.js          # Reports & analytics
└── components/
    ├── navbar.html         # Top navigation component
    ├── sidebar.html        # Sidebar navigation component
    └── modals.html         # Common modal templates
```

## Features

### Authentication
- JWT-based authentication
- Token stored in localStorage
- Auto-redirect to login if token expired/invalid

### Dashboard
- Key metrics cards (Total Enquiries, New Today, Overdue, Converted)
- Recent enquiries list
- Real-time statistics

### Enquiries
- **List View:**
  - Table with sorting
  - Search by name/mobile
  - Filter by status and course
  - Pagination
  - Visual highlights (yellow for unassigned, red for overdue)

- **Detail View:**
  - Complete enquiry information
  - Status management buttons
  - Notes system
  - Follow-up date picker
  - Activity timeline
  - Auto-assignment on interaction
  - Permission-based controls

- **Create Enquiry:**
  - Modal form
  - Fields: Name, Mobile, Email, Course, Source, Notes

- **Bulk Upload (Admin only):**
  - Excel file upload
  - Batch processing

### Admissions
- Converted enquiries list
- Admission details view
- Fee management (Total, Paid, Pending)
- Installment alerts:
  - Upcoming installments
  - Overdue installments
- Lock/Unlock admissions (Admin only)
- Permission-based editing

### Payments
- Payment recording
- Multiple payment modes (Cash, Card, UPI, Bank Transfer, Cheque)
- Payment history
- Receipt generation & printing
- Fee summary per admission

### Reports (Admin only)
- Date range filters (Daily, Weekly, Monthly, Custom)
- Key metrics:
  - Total Enquiries
  - Total Admissions
  - Conversion Rate
  - Total Revenue
- Fees overview
- Status distribution charts
- Counselor performance
- Course performance

## API Configuration

Base URL: `http://localhost:5000/api`

### Authentication Endpoints
```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Enquiry Endpoints
```
GET    /api/enquiries
POST   /api/enquiries
GET    /api/enquiries/:id
PATCH  /api/enquiries/:id/status
PATCH  /api/enquiries/:id/followup
POST   /api/enquiries/:id/notes
GET    /api/enquiries/:id/timeline
```

### Admission Endpoints
```
GET    /api/admissions
POST   /api/admissions
GET    /api/admissions/:id
POST   /api/admissions/:id/lock
POST   /api/admissions/:id/unlock
```

### Payment Endpoints
```
GET    /api/payments
POST   /api/payments
GET    /api/payments/:id/receipt
```

### Reports Endpoints
```
GET /api/reports/dashboard
GET /api/reports/enquiries
GET /api/reports/admissions
GET /api/reports/revenue
GET /api/reports/counselor
GET /api/reports/course
```

### Bulk Upload
```
POST /api/bulk-upload/enquiries
```

## Status Values

- **New** - Fresh enquiry
- **Attempted** - Contact attempted
- **Connected** - Successfully contacted
- **Interested** - Showed interest
- **Follow-up** - Scheduled follow-up
- **Converted** - Enrolled as student
- **Lost** - Not interested/unreachable

## Security Features

1. **JWT Authentication** - All API calls include Bearer token
2. **Role-based Access Control** - Admin vs Counselor permissions
3. **Auto-redirect** - Unauthenticated users redirected to login
4. **Assignment Locking** - Only assigned counselor or admin can edit
5. **Admission Locking** - Locked admissions only editable by admin

## Visual Indicators

- **Yellow Highlight** - Unassigned enquiries
- **Red Highlight** - Overdue follow-ups
- **Lock Badge** - Read-only mode for non-assigned users

## Getting Started

1. Open `index.html` in a browser
2. Login with credentials:
   - Email: `admin@institute.com`
   - Password: `password`
3. Navigate through the sidebar menu

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Development Notes

- All JavaScript is modular and loaded in dependency order
- API calls use Axios with automatic token attachment
- Toast notifications for user feedback
- Responsive design for mobile and desktop
- No external CSS frameworks beyond Tailwind
