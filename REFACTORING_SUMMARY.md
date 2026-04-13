# CRM Frontend Refactoring Summary

## Changes Overview

This document summarizes the changes made to align the CRM frontend with backend logic, improve UX, and implement role-based UI controls.

---

## 1. Role-Based UI Control (`js/auth.js`)

### New Functions Added:
- `isCounselor()` - Check if current user is a counselor
- `getCurrentUserId()` - Get current user's ID
- `canEdit(enquiry)` - Check if user can edit an enquiry (ADMIN or assigned counselor)
- `canDelete()` - Check if user can delete (ADMIN only)
- `canView(enquiry)` - Check if user can view (admin sees all, counselor sees assigned + unassigned)

### Role Handling:
- Supports both uppercase ('ADMIN', 'COUNSELOR') and lowercase ('admin', 'counselor') role formats
- All functions exported globally for use across modules

---

## 2. Work Page - Enquiries List (`enquiries.html` + `js/enquiry.js`)

### Counselor View Restrictions:
- Counselors see only **unassigned enquiries** and **their assigned enquiries**
- Added `assignedToMe` and `includeUnassigned` parameters for API calls when user is a counselor
- Delete button hidden for non-admin users
- Edit link shown only for enquiries the user can edit

### Assignment Display:
- Shows "Unassigned" in yellow for unassigned enquiries
- Shows "Counselor Name (You)" in green for user's assigned enquiries
- Shows "Counselor Name" in gray for others' enquiries

### Loading States:
- Added `isLoading` flag to prevent duplicate API calls
- Shows spinner animation while loading
- Toast notifications for load errors

---

## 3. View Page - Enquiry Detail (`enquiry-detail.html` + `js/enquiry.js`)

### Consolidated Status Update Form:
Replaced individual status buttons with a single form containing:
- **Status dropdown** - Populated dynamically based on valid transitions
- **Note field** - Required for all status updates
- **Follow-up date** - Conditionally shown when status is "Follow-up"

### Status Flow Control:
- `VALID_STATUS_TRANSITIONS` object defines allowed transitions:
  - `New` → Attempted, Connected, Lost
  - `Attempted` → Connected, Lost
  - `Connected` → Interested, Follow-up, Lost
  - `Interested` → Follow-up, Converted, Lost
  - `Follow-up` → Interested, Converted, Lost
  - `Converted` → (terminal state)
  - `Lost` → New (can reopen)

### Form Validation:
- Real-time validation as user types
- Submit button disabled until:
  - Status is selected
  - Note is not empty
  - Follow-up date is set (required for Follow-up status)

### Role-Based Controls:
- If user cannot edit: entire status section is disabled with "Locked" badge visible
- Converted option disabled if admission already exists
- Form validation enforces backend rules

### Loading & Error UX:
- Button shows spinner during API calls
- Error messages displayed inline in form
- Toast notifications for success/error

### Removed Components:
- Individual status buttons
- Separate "Add Note" section
- Separate "Update Follow-up" section (now part of status form)

---

## 4. Dashboard (`js/dashboard.js`)

### Revenue Calculation:
- Now fetches payments data from `API_ENDPOINTS.PAYMENTS.LIST`
- Revenue = `sum(payments.amount)` using **payment date** (NOT enquiry date)
- Calculates both total revenue and today's revenue

### Counselor Filtering:
- Recent enquiries filtered for counselors (assigned + unassigned only)
- Assignment display shows color-coded status (green = yours, yellow = unassigned, gray = others)

### Loading States:
- `isLoadingStats` flag prevents concurrent requests
- Error toast on load failure

---

## 5. Reports (`js/reports.js`)

### Revenue Calculation:
- Fetches payments data alongside admissions/fees data
- Revenue calculated from actual payments using payment date
- Collection rate = `(totalPayments / expectedFees) * 100`

### Fees Overview:
- `totalCollected` = sum of payment amounts
- `totalPending` = expected - collected (never negative)

---

## API Endpoint Structure

The following endpoints are expected from the backend:

```javascript
// Counselor filtering
GET /api/enquiries?assignedToMe=true&includeUnassigned=true

// Status update with note
PATCH /api/enquiries/:id/status
Body: { status, note, followUpDate? }

// Payments for revenue calculation
GET /api/payments?startDate=...&endDate=...
```

---

## Security Improvements

1. **Frontend validates** before API calls to prevent unnecessary requests
2. **Role checks** prevent showing UI elements users can't access
3. **Status transitions** restricted to valid flows only
4. **Ownership verification** before any edit operation

---

## UX Improvements

1. **Consolidated forms** - Single status update form instead of scattered UI
2. **Real-time validation** - Immediate feedback as users type
3. **Loading indicators** - Spinners on all async operations
4. **Clearer assignment display** - Color-coded assignment info
5. **Toast notifications** - Success/error feedback for all operations

---

## Files Modified

- `js/auth.js` - Role helper functions
- `js/enquiry.js` - Role-based controls, status form, loading states
- `js/dashboard.js` - Revenue from payments, counselor filtering
- `js/reports.js` - Revenue calculation from payments
- `enquiry-detail.html` - Consolidated status form

---

## Testing Recommendations

1. Test as **Admin**: Verify full access to all enquiries and delete capability
2. Test as **Counselor**: Verify only assigned + unassigned enquiries visible
3. Test **status transitions**: Verify invalid transitions blocked
4. Test **form validation**: Verify note required, follow-up date for Follow-up status
5. Test **revenue calculation**: Verify uses payment date, not enquiry date
