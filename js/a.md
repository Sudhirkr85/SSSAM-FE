# Frontend Implementation Guide: Duplicate Enquiry Handling & Course Change Flow

Implement enquiry creation and editing flows that handle duplicate mobile numbers, show existing student details, and create new enquiries for additional courses after admission.

---

## 1. Create Enquiry Flow

### API Endpoint
```
POST /api/enquiries
Body: { name, email, mobile, course, source, ... }
```

### Success Response (201)
```json
{
  "status": "success",
  "data": { "enquiry": { ... } },
  "message": "Enquiry created successfully"
}
```

### Duplicate Response (409)
```json
{
  "status": "error",
  "message": "Student already registered",
  "code": 409,
  "data": {
    "duplicate": true,
    "existingEnquiry": {
      "_id": "...",
      "name": "Ravi Kumar",
      "mobile": "9999999999",
      "course": "Python",
      "status": "ADMITTED",
      "assignedTo": { "name": "Counselor A" },
      "isOverdue": false,
      "followUpDate": "2024-01-15",
      "statusHistory": [...]
    }
  }
}
```

### Frontend Implementation

#### Step 1: Submit Create Form
```javascript
async function handleCreateEnquiry(formData) {
  try {
    const response = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (response.status === 409) {
      const errorData = await response.json();
      showDuplicateModal(errorData.data.existingEnquiry);
      return;
    }

    const data = await response.json();
    showSuccess('Enquiry created successfully');
    redirectToEnquiryList();

  } catch (error) {
    showError('Something went wrong');
  }
}
```

#### Step 2: Show Duplicate Detected Modal
When mobile already exists, show a modal with:

- **Title**: "Student Already Registered"
- **Student Details Card**:
  - Name: `{existingEnquiry.name}`
  - Mobile: `{existingEnquiry.mobile}`
  - Current Course: `{existingEnquiry.course}`
  - Status: `{existingEnquiry.status || 'New'}`
  - Assigned To: `{existingEnquiry.assignedTo?.name || 'Unassigned'}`
  - Follow-up Date: `{existingEnquiry.followUpDate || 'Not set'}`

- **Action Buttons**:
  - **"Edit Existing"** → Opens enquiry edit form with existing data
  - **"Create New Enquiry for Different Course"** → Opens create form, pre-fills name, email, mobile. Counselor enters NEW course.
  - **"Cancel"** → Closes modal

```javascript
function showDuplicateModal(existingEnquiry) {
  openModal({
    title: 'Student Already Registered',
    content: DuplicateStudentCard(existingEnquiry),
    actions: [
      {
        label: 'Edit Existing',
        onClick: () => navigateToEditEnquiry(existingEnquiry._id)
      },
      {
        label: 'New Course Enquiry',
        onClick: () => navigateToCreateEnquiry({
          name: existingEnquiry.name,
          email: existingEnquiry.email,
          mobile: existingEnquiry.mobile,
          // course field empty - counselor enters new course
        })
      },
      {
        label: 'Cancel',
        variant: 'secondary'
      }
    ]
  });
}
```

---

## 2. Edit Enquiry Flow

### API Endpoint
```
PUT /api/enquiries/:id/update
Body: { name, email, mobile, course, status, followUpDate, ... }
```

### Important: Course Change Behavior

| Scenario | Backend Behavior | Frontend Action |
|----------|---------------|----------------|
| Student **NOT admitted**, course changed | Updates SAME enquiry record | Show success, stay on same enquiry page |
| Student **ADMITTED**, course changed | Creates **NEW enquiry** for new course | Show success, redirect to NEW enquiry page |
| Admission exists for NEW course | Returns 400 error | Show error: "Admission already exists for this course" |

### Frontend Implementation

```javascript
async function handleUpdateEnquiry(enquiryId, formData) {
  try {
    const response = await fetch(`/api/enquiries/${enquiryId}/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.message?.includes('Admission already exists')) {
        showError('Admission already exists for this course. Cannot change.');
      } else {
        showError(data.message);
      }
      return;
    }

    const updatedEnquiry = data.data.enquiry;

    // Check if this is a NEW enquiry (different _id)
    if (updatedEnquiry._id !== enquiryId) {
      showSuccess('New enquiry created for new course!');
      redirectToEnquiryDetail(updatedEnquiry._id);
    } else {
      showSuccess('Enquiry updated successfully');
      refreshPage();
    }

  } catch (error) {
    showError('Something went wrong');
  }
}
```

### UI Warning When Changing Course on Admitted Student

When editing an admitted student's enquiry and changing course, show a confirmation dialog:

```
┌─────────────────────────────────────────┐
│  ⚠️ Course Change Warning               │
├─────────────────────────────────────────┤
│  This student is already ADMITTED in    │
│  "Python" course.                       │
│                                         │
│  Changing to "Java" will:                 │
│  ✓ Keep the Python admission intact       │
│  ✓ Create a NEW enquiry for Java          │
│  ✓ Start fresh follow-up for Java         │
│                                         │
│  [Cancel]        [Confirm & Create New]   │
└─────────────────────────────────────────┘
```

---

## 3. Student Detail Page — Show All Enquiries

Counselors should see ALL enquiries for a student (same mobile, different courses).

### API
```
GET /api/enquiries?search=9999999999
```

### Display as Timeline/Accordion
```
Student: Ravi Kumar (9999999999)

┌─ Enquiry #1: Python ───────────────┐
│ Status: ADMITTED ✅                  │
│ Admission Date: Jan 10, 2024        │
│ Total Fees: ₹20,000                 │
│ [View Admission] [View Payments]     │
└─────────────────────────────────────┘

┌─ Enquiry #2: Java ─────────────────┐
│ Status: CONTACTED 📞                │
│ Follow-up: Jan 20, 2024             │
│ Assigned: Counselor A             │
│ [Edit] [Mark Follow-up Done]        │
└─────────────────────────────────────┘

[ + Create New Course Enquiry ] Button
```

---

## 4. Create Form — Pre-fill from Existing Student

When counselor clicks "New Course Enquiry" from duplicate modal:

```javascript
function CreateEnquiryPage() {
  const location = useLocation();
  const prefillData = location.state?.prefill; // { name, email, mobile }

  return (
    <EnquiryForm
      initialValues={{
        name: prefillData?.name || '',
        email: prefillData?.email || '',
        mobile: prefillData?.mobile || '',
        course: '' // Always empty - counselor must enter NEW course
      }}
      disabledFields={prefillData ? ['name', 'email', 'mobile'] : []}
      // Mobile field should be read-only when pre-filled
    />
  );
}
```

---

## 5. Edge Cases & Error Handling

| Error | Status | Frontend Message |
|-------|--------|------------------|
| Duplicate mobile (create) | 409 | "Student already registered. Click Edit to update existing." |
| Admission exists for NEW course | 400 | "Admission already exists for [Course]. Cannot change." |
| Invalid mobile format | 400 | "Please enter 10-digit mobile number" |
| CONTACTED without followUpDate | 400 | "Follow-up date required for CONTACTED status" |

---

## 6. Summary Flow Diagram

```
[ Counselor enters mobile in Create Form ]
              ↓
[ Submit to POST /api/enquiries ]
              ↓
    ┌───────────────────────┐
    │ Mobile already exists?  │
    └───────────────────────┘
         YES /         \ NO
          ↓               ↓
[ Show Duplicate Modal ]   [ Create new enquiry ✓ ]
         │
    ┌────┴────┐
    ↓         ↓
[Edit]    [New Course]
Existing   Enquiry
    │         │
    ↓         ↓
[PUT /update] [POST /enquiries]
    │         │
    ↓         ↓
[If admitted + 
 course change]
    │
    ↓
[Backend creates NEW enquiry ✓]
[Redirects to new enquiry page]
```

---

## 7. Required API Endpoints (Already Implemented)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/enquiries` | POST | Create new enquiry |
| `/api/enquiries/:id/update` | PUT | Update enquiry (course change creates new if admitted) |
| `/api/enquiries/:id` | GET | Get single enquiry |
| `/api/enquiries` | GET | List enquiries (use `?search=mobile` to find all for student) |
| `/api/enquiries/:id/assign` | PUT | Assign to counselor (admin only) |
| `/api/public/enquiries` | POST | Public/website enquiry |

---

## 8. Backend Schema Changes (Already Done)

- `Enquiry` model: `mobile` is **unique** index
- `Enquiry` model: `mobile + course` is regular index (performance)
- `Admission` model: `mobile + course` is **unique** index
- `createEnquiry()`: Checks duplicate by `mobile` only
- `updateEnquiry()`: If admitted + course changed → creates new enquiry
- `bulkUpload()`: Checks duplicate by `mobile` only
