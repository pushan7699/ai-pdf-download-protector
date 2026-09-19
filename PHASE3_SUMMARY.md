# Phase 3 Complete: Protected PDF Viewer with Watermarking

## ✅ What Has Been Implemented

### 1. Dynamic Watermarking Service

**File: `backend/src/services/watermarkService.ts`**

Features:
- ✅ PDF page extraction using pdf-lib
- ✅ Dynamic watermark generation
- ✅ User-specific watermark information
- ✅ Multi-position watermarks (corners + diagonal)
- ✅ Session ID embedding
- ✅ Timestamp tracking
- ✅ Document title in watermark
- ✅ Page number tracking

**Watermark Contains:**
```
CONFIDENTIAL
User: John Doe (john@example.com)
Session: 8F29A1BC
Document: Confidential Report.pdf
Time: 2026-09-13T12:00:00.000Z
Page: 1/25
```

**Watermark Positions:**
- Top left corner
- Top center
- Bottom left corner
- Bottom center
- Diagonal across page (large, translucent)

Security Benefits:
- Unique per user/session combination
- Timestamps for audit trail
- Visible deterrent
- Forensic tracking capability

### 2. Viewer Service

**File: `backend/src/services/viewerService.ts`**

Features:
- ✅ Viewing session creation
- ✅ Session token generation (JWT-based)
- ✅ Session validation
- ✅ Permission checking before session creation
- ✅ Concurrent session detection
- ✅ Page-by-page watermarked delivery
- ✅ Session activity tracking
- ✅ Rapid access detection
- ✅ Automatic session expiration (15 minutes)
- ✅ Session termination

**Security Measures:**
1. **Permission Validation**
   - Checks user access before creating session
   - Logs unauthorized attempts
   - Verifies admin/owner status

2. **Concurrent Session Monitoring**
   - Tracks multiple simultaneous sessions
   - Flags users with 3+ concurrent sessions
   - Logs security events for monitoring

3. **Rapid Access Detection**
   - Monitors page views per minute
   - Flags >20 pages/minute as suspicious
   - Logs high-risk security events
   - Prepares for AI analysis (Phase 5)

4. **Token Security**
   - Short-lived tokens (15 minutes)
   - JWT signature validation
   - Database session verification
   - Automatic expiration

### 3. Viewer Controller

**File: `backend/src/controllers/viewerController.ts`**

Endpoints:
- ✅ Create viewing session
- ✅ Get watermarked page
- ✅ Get session information
- ✅ End session
- ✅ Report download attempts
- ✅ Report direct access attempts

Security Headers:
```javascript
Content-Disposition: inline; filename="page.pdf"
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
Expires: 0
X-Content-Type-Options: nosniff
```

### 4. Protected Viewing Flow

```
User Request Flow:
┌──────────────────────────────────────────────────────────────┐
│  1. User authenticates with JWT                              │
│  2. User requests document access                            │
│  3. System checks permissions                                │
│  4. System creates viewing session (15 min token)            │
│  5. User receives session token                              │
│  6. User requests page with session token                    │
│  7. System validates session                                 │
│  8. System extracts page from PDF                            │
│  9. System adds user-specific watermark                      │
│ 10. System delivers watermarked page                         │
│ 11. System logs access and detects patterns                  │
│ 12. Session expires or user ends session                     │
└──────────────────────────────────────────────────────────────┘
```

### 5. API Endpoints

**Viewing Session Management:**

```
POST   /api/documents/:id/view-session
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "data": {
    "session_token": "eyJhbGc...",
    "session_id": "uuid",
    "expires_at": "2026-09-13T12:15:00Z"
  }
}
```

**Get Watermarked Page:**

```
GET    /api/viewer/page/:pageNumber
X-Session-Token: <session_token>

Response: PDF file (watermarked)
```

**Get Session Info:**

```
GET    /api/viewer/session-info
X-Session-Token: <session_token>

Response:
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "documentId": "uuid",
    "documentTitle": "Confidential Report",
    "pageCount": 25,
    "expiresAt": "2026-09-13T12:15:00Z",
    "startedAt": "2026-09-13T12:00:00Z",
    "pageViews": 5
  }
}
```

**End Session:**

```
POST   /api/viewer/end-session
X-Session-Token: <session_token>
```

**Report Security Events:**

```
POST   /api/viewer/report-download-attempt
Authorization: Bearer <jwt_token>
Body: { "document_id": "uuid", "session_id": "uuid", "method": "right-click" }

POST   /api/viewer/report-direct-access
Authorization: Bearer <jwt_token>
Body: { "document_id": "uuid", "attempted_url": "/storage/private/file.pdf" }
```

## 🔐 Security Implementation

### What Normal Users CANNOT Do

❌ Download original PDF
❌ Access PDF storage directly
❌ Get unwatermarked pages
❌ Create sessions without permission
❌ Use expired session tokens
❌ Access pages without session token
❌ Bypass watermarks

### What Admins CAN Do

✅ Download original PDFs (via `/api/admin/documents/:id/download`)
✅ Create viewing sessions for any document
✅ View without permission checks
✅ Manage all users and documents

### Session Security

1. **Token-Based Access**
   - JWT session tokens
   - 15-minute expiration
   - Signature verification
   - Database validation

2. **Activity Monitoring**
   - Every page view logged
   - Rapid access detection
   - Concurrent session tracking
   - Unauthorized attempt logging

3. **No Direct Access**
   - Files in private storage
   - No public URLs
   - Server-side rendering only
   - Controlled page delivery

## 🧪 Testing Phase 3

### Prerequisites

1. PostgreSQL running
2. Database migrated and seeded
3. Backend running on port 5000

### Test Flow

```powershell
# 1. Login as a user
$userBody = @{
    email = "user1@example.com"
    password = "TestUser123!"
} | ConvertTo-Json

$userResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -Body $userBody -ContentType "application/json"
$userToken = $userResponse.data.access_token
Write-Host "User logged in: $($userResponse.data.user.email)"

# 2. Admin uploads a document (or use existing document ID)
# Assuming you have a document ID from Phase 2 testing
$documentId = "your-document-id-here"

# 3. Create viewing session
$headers = @{
    Authorization = "Bearer $userToken"
}

$sessionResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/documents/$documentId/view-session" -Method POST -Headers $headers
$sessionToken = $sessionResponse.data.session_token
$sessionId = $sessionResponse.data.session_id

Write-Host "Viewing session created"
Write-Host "Session ID: $sessionId"
Write-Host "Expires: $($sessionResponse.data.expires_at)"

# 4. Get session info
$sessionHeaders = @{
    "X-Session-Token" = $sessionToken
}

$sessionInfo = Invoke-RestMethod -Uri "http://localhost:5000/api/viewer/session-info" -Method GET -Headers $sessionHeaders
Write-Host "Document: $($sessionInfo.data.documentTitle)"
Write-Host "Total Pages: $($sessionInfo.data.pageCount)"

# 5. View first page (watermarked)
Invoke-WebRequest -Uri "http://localhost:5000/api/viewer/page/0" -Method GET -Headers $sessionHeaders -OutFile "page_0_watermarked.pdf"
Write-Host "Downloaded watermarked page 0"

# 6. View second page
Invoke-WebRequest -Uri "http://localhost:5000/api/viewer/page/1" -Method GET -Headers $sessionHeaders -OutFile "page_1_watermarked.pdf"
Write-Host "Downloaded watermarked page 1"

# 7. Open the PDFs to see watermarks
Start-Process "page_0_watermarked.pdf"
Start-Process "page_1_watermarked.pdf"

# 8. Test rapid access (simulate suspicious behavior)
Write-Host "Testing rapid access detection..."
for ($i = 0; $i -lt 25; $i++) {
    try {
        Invoke-WebRequest -Uri "http://localhost:5000/api/viewer/page/$i" -Method GET -Headers $sessionHeaders -OutFile "temp_page_$i.pdf" -ErrorAction SilentlyContinue
    } catch {}
}
Write-Host "Rapid access test complete - check security events"

# 9. Try to download (should be blocked for normal users)
try {
    Invoke-WebRequest -Uri "http://localhost:5000/api/admin/documents/$documentId/download" -Method GET -Headers @{ Authorization = "Bearer $userToken" } -OutFile "attempted_download.pdf"
} catch {
    Write-Host "Download blocked (expected): $_"
}

# 10. Report download attempt
$reportBody = @{
    document_id = $documentId
    session_id = $sessionId
    method = "test_script"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/viewer/report-download-attempt" -Method POST -Headers $headers -Body $reportBody -ContentType "application/json"
Write-Host "Download attempt reported"

# 11. End session
Invoke-RestMethod -Uri "http://localhost:5000/api/viewer/end-session" -Method POST -Headers $sessionHeaders
Write-Host "Session ended"

# 12. Try to access after session ended (should fail)
try {
    Invoke-WebRequest -Uri "http://localhost:5000/api/viewer/page/0" -Method GET -Headers $sessionHeaders -OutFile "page_after_end.pdf"
} catch {
    Write-Host "Access after session end blocked (expected): $_"
}
```

### Expected Results

1. ✅ Viewing session created with 15-minute token
2. ✅ Each page has visible watermark with user info
3. ✅ Watermark includes:
   - "CONFIDENTIAL" heading
   - User's name and email
   - Session ID (first 8 chars)
   - Document title
   - Timestamp
   - Page number
4. ✅ Rapid access (>20 pages/min) logged as security event
5. ✅ Normal users cannot download via admin endpoint
6. ✅ Download attempts logged
7. ✅ Session expires after 15 minutes
8. ✅ Expired sessions cannot access pages

## 📊 Database Updates

### Tables Used

1. **sessions** - Active viewing sessions
2. **access_logs** - Every page view and session event
3. **security_events** - Suspicious activities
4. **documents** - Document metadata
5. **document_permissions** - Access control

### New Event Types

```
SESSION_START
SESSION_END
SESSION_EXPIRED
SESSION_REVOKED
PAGE_VIEW
PAGE_REQUEST
RAPID_PAGE_ACCESS
DOWNLOAD_ATTEMPT
DIRECT_PDF_REQUEST
UNAUTHORIZED_ACCESS_ATTEMPT
MULTIPLE_SESSION
```

## ✅ Phase 3 Checklist

- [x] Watermark service created
- [x] Dynamic watermark generation
- [x] Multi-position watermarks
- [x] User-specific watermarks
- [x] Viewer service created
- [x] Session token generation
- [x] Session validation
- [x] Permission checking
- [x] Concurrent session detection
- [x] Rapid access detection
- [x] Viewer controller implemented
- [x] Protected page delivery
- [x] Security event logging
- [x] Session expiration
- [x] API routes created
- [x] No-cache headers
- [x] Server updated with routes

## 🔜 Next: Phase 4

**Phase 4 will implement:**
- Enhanced security event monitoring
- Event aggregation and analysis
- User behavior profiling
- Suspicious pattern detection
- Security metrics calculation
- Event dashboard endpoints
- Real-time alerting preparation
- Baseline behavior tracking

This sets the foundation for AI analysis in Phase 5.

## 🛡️ Security Analysis

### What's Protected Now

✅ **Document Access**
- Private storage
- Permission-based access
- Session-based viewing
- Time-limited access

✅ **Watermarking**
- User identification
- Session tracking
- Timestamp forensics
- Visual deterrent

✅ **Monitoring**
- Page view tracking
- Rapid access detection
- Concurrent session flagging
- Unauthorized attempt logging

✅ **Token Security**
- Short-lived (15 min)
- JWT signatures
- Database validation
- Automatic expiration

### What's Still Not Prevented

❌ **User-Level Captures (By Design):**
- Screenshots (OS-level)
- Screen recording (OS-level)
- Photographing screen (physical)
- OCR from screen (external tools)

These are **outside browser control** and documented as limitations.

### Deterrence vs Prevention

This system provides:
- **Strong deterrence** through visible watermarks
- **Complete audit trail** for forensic investigation
- **Technical prevention** of unauthorized API/download access
- **Behavioral monitoring** for suspicious activity detection

---

**Phase 3 Status: ✅ COMPLETE**

Ready to proceed to Phase 4: Enhanced Security Event Logging and Monitoring

**Note:** Frontend React viewer component will be implemented after completing the backend security infrastructure (Phases 4-6), allowing for a complete security-aware UI.
