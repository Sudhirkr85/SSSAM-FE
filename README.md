# Institute Enquiry Management CRM

A production-ready, role-based CRM for managing student enquiries, admissions, and payments.

## Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (ADMIN, COUNSELOR)
- Automatic token refresh and session management

### Enquiry Management
- Create, view, update, and delete enquiries (ADMIN only for delete)
- Status workflow: NEW → CONTACTED → FOLLOW_UP → INTERESTED → ADMISSION_PROCESS → CONVERTED
- Follow-up date tracking with overdue highlighting
- Role-based visibility (Counselors see only assigned + unassigned)
- Debounced search (300ms)
- Bulk upload (ADMIN only)

### Admission Management
- Convert enquiries to admissions
- Payment plan setup (One-time or Installment)
- Installment tracking with due dates
- Payment recording
- Admission locking (ADMIN only)

### Payment Management
- Record payments against admissions
- Installment-based payment tracking
- Receipt generation and printing
- Payment history

### Reports (ADMIN only)
- Dashboard with key metrics
- Revenue reports (Today, Weekly, Monthly, Yearly)
- Enquiry statistics
- Follow-up tracking (Today, Overdue)
- Counselor performance
- Course performance

## API Integration

### Base Configuration
```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

### Global API Response Format
```json
{
  "success": true,
  "message": "",
  "data": {}
}
```

Error Response:
```json
{
  "success": false,
  "message": "Error message"
}
```

### Key Endpoints

#### Auth
- `POST /api/auth/login` - Login with email/password
  - Response: `{ token, user: { id, name, role } }`

#### Enquiries
- `GET /api/enquiries?page=1&limit=10&status=FOLLOW_UP&search=rahul&followUp=today&assigned=me`
- `GET /api/enquiries/:id`
- `POST /api/enquiries` - Create new enquiry
- `PATCH /api/enquiries/:id/status` - Update status with note
- `DELETE /api/enquiries/:id` - Delete enquiry (ADMIN only)

#### Admissions
- `GET /api/admissions`
- `POST /api/admissions/from-enquiry/:enquiryId` - Convert to admission
- `PUT /api/admissions/:id/lock` - Lock admission (ADMIN only)

#### Payments
- `GET /api/payments`
- `POST /api/payments` - Add payment

#### Dashboard
- `GET /api/dashboard` - Get dashboard stats
  - Response: `{ revenue: { today, weekly, monthly, yearly }, enquiries: { today, weekly, monthly }, followUps: { today, overdue } }`

#### Reports
- `GET /api/reports/admissions`
- `GET /api/reports/fees`
- `GET /api/reports/installments`

## Role-Based Access Control

### Admin
- Full access to all features
- Can delete enquiries
- Can view reports
- Can bulk upload
- Can lock admissions
- Sees all enquiries

### Counselor
- Can view assigned + unassigned enquiries only
- Can update status of assigned enquiries
- Cannot delete enquiries
- Cannot view reports
- Cannot bulk upload

### Permission Check Function
```javascript
function canEdit(enquiry) {
    if (isAdmin()) return true;
    const userId = getCurrentUserId();
    const assignedId = enquiry.assignedTo?._id || enquiry.assignedTo?.id;
    return assignedId === userId;
}
```

## Status Enum (Strict)
```javascript
const STATUS = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  NO_RESPONSE: 'NO_RESPONSE',
  FOLLOW_UP: 'FOLLOW_UP',
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  ADMISSION_PROCESS: 'ADMISSION_PROCESS',
  CONVERTED: 'CONVERTED'
};
```

### Valid Status Transitions
```javascript
const STATUS_FLOW = {
  [STATUS.NEW]: [STATUS.CONTACTED, STATUS.NO_RESPONSE],
  [STATUS.CONTACTED]: [STATUS.FOLLOW_UP, STATUS.INTERESTED, STATUS.NOT_INTERESTED],
  [STATUS.NO_RESPONSE]: [STATUS.FOLLOW_UP, STATUS.NOT_INTERESTED],
  [STATUS.FOLLOW_UP]: [STATUS.CONTACTED, STATUS.INTERESTED, STATUS.NOT_INTERESTED],
  [STATUS.INTERESTED]: [STATUS.ADMISSION_PROCESS, STATUS.NOT_INTERESTED],
  [STATUS.NOT_INTERESTED]: [], // Terminal
  [STATUS.ADMISSION_PROCESS]: [STATUS.CONVERTED],
  [STATUS.CONVERTED]: [] // Terminal
};
```

## File Structure

```
├── index.html          # Login page
├── dashboard.html      # Dashboard with stats
├── enquiries.html      # Enquiry list with filters
├── enquiry-detail.html # Enquiry detail & status update
├── admissions.html     # Admission management
├── payments.html       # Payment recording
├── reports.html      # Reports (ADMIN only)
├── css/
│   └── styles.css     # Custom styles
└── js/
    ├── api.js         # API configuration & endpoints
    ├── ui.js          # UI utilities, STATUS enum, helpers
    ├── auth.js        # Authentication & authorization
    ├── app.js         # App initialization & role-based UI
    ├── dashboard.js   # Dashboard stats
    ├── enquiry.js     # Enquiry management
    ├── admission.js   # Admission management
    ├── payment.js     # Payment management
    └── reports.js     # Reports
```

## Usage

### Login
1. Open `index.html`
2. Enter email and password
3. System redirects based on role

### Creating an Enquiry
1. Go to Enquiries page
2. Click "New Enquiry"
3. Fill in details (Name, Mobile with +91 prefix, Course)
4. Submit

### Updating Status
1. Open enquiry detail page
2. Select new status from dropdown
3. Add note (required)
4. Set follow-up date if status is FOLLOW_UP
5. Submit

### Converting to Admission
1. Update enquiry status to CONVERTED
2. Click "Convert Now" button
3. Select payment type (One-time or Installment)
4. Set total fees
5. Add installments if applicable
6. Submit

### Recording Payment
1. Go to Payments page
2. Click "Add Payment"
3. Select admission
4. Enter amount and date
5. Submit

## Security Features

1. **JWT Token Management**: Automatic token attachment to requests
2. **401 Handling**: Redirects to login on unauthorized
3. **403 Handling**: Shows access denied toast
4. **Role-based UI**: Elements hidden based on role
5. **Permission Checks**: Server and client-side validation
6. **No Sensitive Data Exposure**: API calls filtered by role

## API Call Optimization

- Only calls APIs needed for role
- Avoids calling `/all` for counselors
- Uses pagination (limit=10 default)
- Debounced search (300ms)
- Filtered params (removes empty/null values)

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Dependencies

- Tailwind CSS (via CDN)
- Axios (via CDN)

## License

Internal Use Only
