# Clinic Flow

# PROJECT TITLE

Dental Clinic Attendance, Employee Profile, and Appointment Reminder Management System

---

# 1. PROJECT OBJECTIVE

Build a production-ready internal web application for a small dental clinic with fewer than 20 employees.

The system must combine:

1. Employee management

2. Detailed employee profiles

3. Attendance device synchronization

4. Shift and attendance calculation

5. Overtime, lateness, early leave, and attendance adjustments

6. Monthly attendance reports

7. Excel exports

8. Patient appointment management

9. Appointment reminders

10. Clinic profile and system settings

11. Role-based access control

12. Audit logs

The first release is designed for:

- One dental clinic

- One physical location

- Fewer than 20 employees

- One attendance device

- One Windows PC connected to the attendance device through the local network

- Vietnamese users

- Desktop-first responsive design

- Supabase as the backend

The system should look like a premium dental clinic management platform, not a generic admin dashboard.

---

# 2. IMPORTANT PRODUCT BOUNDARIES

This is not a complete hospital information system.

Do not build the following in the initial release:

- Electronic medical records

- Medical diagnosis

- Dental treatment records

- Prescription management

- Medical imaging

- Dental charting

- Insurance processing

- Payroll, tax, or social insurance calculation

- Inventory management

- Accounting

- Mobile application

- Multi-clinic SaaS billing

- Public patient portal

The appointment module may store:

- Patient name

- Phone number

- Email

- Appointment date and time

- Assigned dentist or employee

- Service category

- Appointment status

- Basic non-medical notes

- Reminder history

Do not store detailed medical information in the appointment module.

---

# 3. RECOMMENDED TECHNOLOGY STACK

Use the following stack unless the existing repository already defines compatible alternatives:

## Frontend

- React

- TypeScript

- Vite

- React Router

- Tailwind CSS

- shadcn/ui

- Lucide React

- React Hook Form

- Zod

- TanStack Query

- TanStack Table

- date-fns

- Recharts

- ExcelJS

## Backend

- Supabase PostgreSQL

- Supabase Auth

- Supabase Row Level Security

- Supabase Storage for employee avatars and clinic assets

- Supabase Edge Functions where server-side logic is required

## Attendance Sync Agent

Create this as a separate application:

- Node.js and TypeScript for the initial version

- Package it as a Windows executable

- It must run automatically when Windows starts

- It must connect to the attendance device over local TCP/IP

- It must send attendance logs to a secure Supabase endpoint

Later, the agent may be rewritten in Go, but do not block the MVP on this.

---

# 4. SYSTEM ARCHITECTURE

Use this architecture:

Attendance Device

    ↓ Local TCP/IP

Windows Sync Agent

    ↓ Secure HTTPS

Supabase Database

    ↓

Dental Clinic Web Application

The attendance device is currently expected to be reachable using:

- Local IP: 192.168.1.202

- Port: 4370

- Communication key: 0

Do not hardcode these values.

Store device configuration in the database and provide a secure setup flow.

The web application must never attempt to connect directly to the local attendance device from the browser.

The Windows Sync Agent is responsible for communicating with the device.

---

# 5. DESIGN DIRECTION

Create a premium, clean, trustworthy dental clinic interface.

The UI must feel:

- Modern

- Professional

- Calm

- Medical

- Friendly

- Highly readable

- Suitable for clinic receptionists and administrators

- Easy to use for non-technical staff

Avoid:

- Generic enterprise dashboard styling

- Excessive gradients

- Neon effects

- Overly playful illustrations

- Dense information

- Tiny text

- Too many colors

- Unnecessary animations

- Medical imagery that feels frightening

## Suggested Color System

Primary:

- Dental Blue: #1570EF

- Deep Navy: #12345B

Secondary:

- Aqua: #27B6B0

- Soft Sky: #EAF4FF

Status Colors:

- Success: #16A36A

- Warning: #F59E0B

- Danger: #E5484D

- Information: #3B82F6

Neutral:

- Background: #F7F9FC

- Surface: #FFFFFF

- Border: #E5EAF0

- Main Text: #172033

- Secondary Text: #667085

Use CSS variables and design tokens.

Support light mode first.

Dark mode is optional and must not delay the MVP.

## Typography

Use:

- Inter, Be Vietnam Pro, or a similarly readable sans-serif font

- Clear Vietnamese language support

- Large page titles

- Comfortable table text

- Accessible contrast

## Layout

Desktop layout:

- Collapsible left sidebar

- Sticky top header

- Main content container

- Page breadcrumbs

- Notification area

- User account menu

Mobile layout:

- Bottom or drawer navigation

- Responsive tables

- Cards for important records

- No horizontal overflow for essential workflows

---

# 6. USER ROLES

Implement the following roles:

## Administrator

Full access to:

- Dashboard

- Employees

- Attendance

- Shifts

- Appointments

- Reports

- Device configuration

- Clinic profile

- User accounts

- Settings

- Audit logs

## Human Resources or Clinic Manager

Access to:

- Employees

- Attendance

- Shifts

- Attendance adjustments

- Reports

- Appointments

- Basic settings

Cannot:

- Modify system-level security settings

- Delete audit logs

- Access sensitive integration credentials

## Receptionist

Access to:

- Appointment calendar

- Patient contact records

- Appointment reminders

- Appointment statuses

- Daily appointment dashboard

Limited employee and attendance access.

## Employee

Optional in the MVP.

May access:

- Personal profile

- Personal attendance history

- Personal monthly attendance

- Personal upcoming schedule

Do not allow employees to modify attendance records.

---

# 7. MAIN NAVIGATION

Create the sidebar with the following structure:

1. Dashboard

2. Appointments

   - Appointment Calendar

   - Appointment List

   - Reminder Queue

   - Patients

3. Human Resources

   - Employees

   - Departments

   - Positions

   - Work Shifts

4. Attendance

   - Daily Attendance

   - Monthly Timesheet

   - Raw Attendance Logs

   - Attendance Adjustments

   - Overtime

   - Missing Check-ins

5. Reports

   - Attendance Report

   - Late and Early Leave Report

   - Overtime Report

   - Appointment Report

   - Reminder Report

6. System

   - Attendance Devices

   - Sync Status

   - Clinic Profile

   - User Management

   - System Settings

   - Audit Logs

---

# 8. DASHBOARD

Build a polished clinic operations dashboard.

## Header

Display:

- Greeting based on local time

- Current date

- Clinic name

- Quick appointment creation button

- Quick employee creation button

## KPI Cards

Display:

- Employees working today

- Employees late today

- Employees absent today

- Missing check-outs

- Appointments today

- Confirmed appointments

- Appointments awaiting confirmation

- Cancelled appointments

## Attendance Overview

Include:

- Present

- Late

- Absent

- On leave

- Missing attendance data

Use a clean donut chart or bar chart.

## Today’s Appointments

Display:

- Appointment time

- Patient name

- Phone number

- Service

- Assigned dentist

- Status

- Confirmation status

Provide quick actions:

- Confirm

- Mark arrived

- Mark completed

- Reschedule

- Cancel

- Send reminder

## Employees Requiring Attention

Display:

- Late employees

- Missing check-ins

- Missing check-outs

- Pending attendance adjustments

- Excessive overtime

## Device Sync Status

Display:

- Device name

- Online or offline status

- Last successful sync

- Last log received

- Pending unsynchronized logs

- Agent version

- Sync error message when applicable

---

# 9. CLINIC PROFILE

Create a detailed clinic profile configuration page.

Fields:

- Clinic name

- Short clinic name

- Legal business name

- Logo

- Favicon

- Cover image

- Address

- Ward

- District

- City or province

- Google Maps URL

- Main phone number

- Hotline

- Appointment phone number

- Email

- Website

- Facebook

- Zalo

- Working hours

- Lunch break

- Weekly days off

- Tax code

- Representative name

- Clinic manager

- Default timezone

- Default language

- Date format

- Time format

- Appointment reminder policy

- Attendance policy

- Overtime policy

- Grace period

- Clinic description

- Footer information

Create a live branding preview.

Use the clinic logo and clinic name throughout the application after configuration.

---

# 10. EMPLOYEE MANAGEMENT

## Employee List

Create a high-quality employee directory.

Display:

- Avatar

- Employee code

- Full name

- Position

- Department

- Phone

- Employment status

- Assigned shift

- Attendance device user ID

- Start date

- Quick actions

Filters:

- Search by name

- Search by employee code

- Department

- Position

- Status

- Shift

- Has device mapping

- Missing profile information

Views:

- Table view

- Card view

Actions:

- Add employee

- Edit

- View profile

- Disable

- Export

- Assign shift

- Link attendance device ID

## Employee Profile

Create a detailed employee profile with the following sections.

### Profile Header

- Avatar

- Full name

- Employee code

- Position

- Department

- Employment status

- Phone number

- Email

- Quick edit button

### Personal Information

- Full name

- Preferred name

- Gender

- Date of birth

- Phone

- Email

- Personal address

- Identity document number

- Identity document issue date

- Identity document issue place

- Emergency contact name

- Emergency contact relationship

- Emergency contact phone

Store identity document data carefully and restrict access by role.

### Employment Information

- Employee code

- Attendance device user ID

- Department

- Position

- Employment type

- Start date

- Probation end date

- Contract start date

- Contract end date

- Employment status

- Default work shift

- Work location

- Direct manager

- Internal notes

### Professional Information

Because this is a dental clinic, include optional fields:

- Professional title

- Professional license number

- License issue date

- License expiration date

- Specialization

- Years of experience

- Qualifications

- Certificates

- Assigned treatment room

- Can receive appointments

- Appointment display name

Do not implement clinical record functionality.

### Documents

Allow controlled uploads for:

- Profile photo

- Identity document

- Employment contract

- Degree

- Professional certificate

- Other documents

Each document must include:

- Document name

- Document category

- File URL

- Issue date

- Expiration date

- Notes

- Uploaded by

- Uploaded at

### Attendance Summary

Display:

- Attendance this month

- Days present

- Late occurrences

- Early leave occurrences

- Overtime hours

- Missing check-ins

- Leave days

- Attendance trend

### Upcoming Work Schedule

Display assigned shifts in calendar format.

### Activity History

Display employee-related changes from audit logs.

---

# 11. DEPARTMENTS AND POSITIONS

Suggested departments:

- Dentists

- Dental Assistants

- Reception

- Customer Care

- Administration

- Accounting

- Marketing

- Management

Allow administrators to create custom departments.

Position fields:

- Position name

- Department

- Description

- Status

- Can receive appointments

- Display order

---

# 12. SHIFT MANAGEMENT

Create flexible but simple shift management.

Shift fields:

- Shift name

- Shift code

- Start time

- End time

- Break start

- Break end

- Paid break or unpaid break

- Grace period in minutes

- Early check-in window

- Late check-in threshold

- Early leave threshold

- Overtime threshold

- Minimum overtime minutes

- Crosses midnight

- Working days

- Status

- Notes

Default examples:

- Morning Shift: 08:00–12:00

- Afternoon Shift: 13:30–17:30

- Evening Shift: 17:30–20:30

- Full Day Shift: 08:00–17:30

Support:

- Default employee shift

- Daily shift assignment

- Temporary shift override

- Weekly recurring assignment

Do not overengineer advanced workforce scheduling in the MVP.

---

# 13. ATTENDANCE DEVICE MANAGEMENT

## Device List

Display:

- Device name

- Device code

- Model

- Serial number

- IP address

- Port

- Connection type

- Communication key status

- Branch

- Agent name

- Last sync

- Last successful connection

- Online status

- Total logs received

- Active status

Never display the full communication key after saving it.

## Device Detail

Include:

- Connection information

- Sync history

- Error history

- Device employee mappings

- Last 100 received logs

- Agent status

- Manual sync request

- Reprocess attendance button

## Sync Agent Requirements

The Windows agent must:

1. Start automatically with Windows.

2. Run without requiring a visible terminal window.

3. Connect to the local attendance device.

4. Retrieve employee records where supported.

5. Retrieve attendance logs.

6. Save a local sync checkpoint.

7. Upload logs through HTTPS.

8. Retry failed requests.

9. Prevent duplicate uploads.

10. Continue after internet interruptions.

11. Continue after device interruptions.

12. Send heartbeat status.

13. Send agent version.

14. Log local errors.

15. Avoid exposing Supabase service role keys.

Use a restricted integration token or secure server endpoint.

The agent should synchronize every one to five minutes.

The interval must be configurable.

## Duplicate Prevention

Create a deterministic unique key from:

- Organization or clinic ID

- Device ID

- Employee device user ID

- Punch timestamp

- Punch state

- Verification mode

Create a unique database constraint.

Never rely only on the frontend to prevent duplicates.

---

# 14. RAW ATTENDANCE LOGS

Create a read-only raw log page.

Fields:

- Employee device ID

- Mapped employee

- Punch timestamp

- Device

- Punch type

- Verification mode

- Work code

- Imported at

- Sync run

- Raw payload

- Processing status

Filters:

- Date range

- Employee

- Device

- Mapped or unmapped

- Processing status

- Verification method

Raw logs must not be edited or deleted through normal UI.

Administrative corrections must be stored separately.

---

# 15. ATTENDANCE CALCULATION ENGINE

Separate raw attendance logs from calculated attendance records.

Use this flow:

Raw device logs

    ↓

Employee mapping

    ↓

Shift assignment

    ↓

Attendance calculation

    ↓

Manual adjustment

    ↓

Final attendance record

## Basic Daily Logic

For a normal same-day shift:

- First valid log is the check-in

- Last valid log is the check-out

- Preserve intermediate logs

- If there is only one log, mark the day as incomplete

- Ignore duplicate logs

- Apply grace period

- Calculate late minutes

- Calculate early leave minutes

- Calculate working minutes

- Calculate overtime minutes

- Apply approved adjustments

- Keep calculation traceability

## Required Fields

Calculated daily attendance:

- Employee

- Work date

- Shift

- Scheduled start

- Scheduled end

- First check-in

- Last check-out

- Worked minutes

- Scheduled minutes

- Late minutes

- Early leave minutes

- Overtime minutes

- Missing check-in

- Missing check-out

- Attendance status

- Calculation version

- Last calculated at

- Adjustment status

- Finalized status

## Attendance Statuses

- Present

- Late

- Early Leave

- Late and Early Leave

- Absent

- On Leave

- Incomplete

- Day Off

- Holiday

- Business Trip

- Manually Adjusted

## Overtime Rules

Support:

- Overtime only after the configured shift end

- Minimum overtime threshold

- Optional overtime rounding

- Manual approval status

- Approved overtime minutes

- Rejected overtime minutes

Default MVP behavior:

- Overtime starts after shift end

- Ignore overtime below 30 minutes

- Allow administrators to adjust this in settings

## Important Edge Cases

Handle:

- Multiple punches in one day

- Forgotten check-in

- Forgotten check-out

- Cross-midnight shift

- Shift changed after logs already exist

- Employee changed department

- Device ID mapped after logs were imported

- Internet lost during synchronization

- PC restarted

- Attendance device offline

- Duplicate logs

- Manual attendance record

- Approved leave overriding absence

- Employee works on scheduled day off

Do not silently destroy or overwrite historical data.

---

# 16. ATTENDANCE ADJUSTMENTS

Create a proper correction workflow.

Adjustment fields:

- Employee

- Work date

- Adjustment type

- Original check-in

- Original check-out

- Requested check-in

- Requested check-out

- Reason

- Attachment

- Requested by

- Requested at

- Approval status

- Approved by

- Approved at

- Rejection reason

Adjustment types:

- Missing check-in

- Missing check-out

- Incorrect timestamp

- Business trip

- External work

- Approved late arrival

- Approved early leave

- Other

For a small clinic, allow administrator or clinic manager to approve directly.

Never modify raw device logs.

Apply approved adjustments to the calculated daily attendance record.

---

# 17. MONTHLY TIMESHEET

Create a premium spreadsheet-style monthly attendance page.

Rows:

- Employees

Columns:

- Each day of the selected month

- Total working days

- Present days

- Late occurrences

- Late minutes

- Early leave occurrences

- Early leave minutes

- Overtime hours

- Leave days

- Absent days

- Missing records

Each date cell should show a concise status:

- Present

- Late

- Leave

- Absent

- Incomplete

- Day off

Use status badges or compact indicators.

Clicking a cell must open a detailed attendance drawer.

Filters:

- Month

- Department

- Employee

- Shift

- Attendance status

Provide:

- Recalculate month

- Finalize month

- Export Excel

- Print report

---

# 18. EXCEL EXPORT

Use ExcelJS.

Create professionally formatted exports.

## Monthly Attendance Export

Include:

- Clinic logo

- Clinic name

- Report title

- Report month

- Employee code

- Employee name

- Department

- Position

- Daily attendance

- Total working days

- Total worked hours

- Late count

- Late minutes

- Early leave count

- Early leave minutes

- Overtime hours

- Leave days

- Absent days

- Notes

Use:

- Frozen headers

- Borders

- Reasonable column widths

- Date formatting

- Status legend

- Print-friendly layout

- Vietnamese labels

## Additional Exports

- Employee list

- Daily attendance

- Late and early leave report

- Overtime report

- Appointment list

- Appointment reminder report

---

# 19. PATIENT CONTACT MANAGEMENT

Create a lightweight patient contact module.

This is not a medical record.

Fields:

- Patient code

- Full name

- Phone number

- Secondary phone

- Email

- Date of birth

- Gender

- Address

- Source

- Assigned customer care employee

- Preferred contact channel

- Last appointment

- Next appointment

- General non-medical notes

- Active status

- Created at

- Updated at

Patient sources:

- Walk-in

- Facebook

- Website

- Zalo

- Referral

- Existing patient

- Advertising

- Other

Support duplicate detection using normalized phone numbers.

Show a warning when creating a patient with an existing phone number.

---

# 20. APPOINTMENT MANAGEMENT

## Appointment Fields

- Patient

- Appointment date

- Start time

- End time

- Assigned dentist

- Assigned dental assistant

- Service category

- Treatment room

- Appointment status

- Confirmation status

- Patient source

- Reminder policy

- Internal non-medical notes

- Created by

- Updated by

## Service Categories

Create configurable service categories such as:

- Dental examination

- Cleaning

- Whitening

- Filling

- Root canal consultation

- Orthodontic consultation

- Implant consultation

- Tooth extraction consultation

- Follow-up appointment

- Other

These are appointment categories only.

Do not create clinical treatment records.

## Appointment Statuses

- Draft

- Scheduled

- Awaiting Confirmation

- Confirmed

- Patient Arrived

- In Progress

- Completed

- Rescheduled

- Cancelled

- No Show

## Views

Create:

- Day calendar

- Week calendar

- Month calendar

- List view

The default should be the day or week view.

Appointment cards must show:

- Time

- Patient

- Phone

- Service

- Dentist

- Confirmation status

- Appointment status

## Conflict Detection

Warn when:

- Dentist already has another appointment

- Room already has another appointment

- Appointment is outside clinic working hours

- Assigned employee is not working during that time

- Appointment overlaps another appointment

Allow authorized users to override conflicts with a reason.

---

# 21. APPOINTMENT REMINDERS

Create a reminder engine and reminder queue.

## Reminder Types

Support:

- Manual reminder

- Automatic reminder

- Appointment confirmation request

- Reschedule reminder

- Follow-up reminder

## Reminder Timing

Allow clinic settings such as:

- 24 hours before appointment

- 3 hours before appointment

- Custom reminder time

For the MVP, build the reminder workflow first.

Do not claim a reminder was sent unless an actual messaging provider confirms delivery.

## Reminder Channels

Design the system to support:

- SMS

- Zalo

- Email

- Manual phone call

Initial release may implement:

- Manual phone call status

- Email when SMTP or a provider is configured

- Provider abstraction for SMS and Zalo

Do not hardcode an unofficial messaging automation.

## Reminder Queue

Display:

- Patient

- Phone

- Appointment time

- Channel

- Scheduled reminder time

- Reminder status

- Attempt count

- Last attempt

- Failure reason

- Assigned receptionist

Reminder statuses:

- Pending

- Processing

- Sent

- Delivered

- Failed

- Cancelled

- Contacted by Phone

- No Answer

Quick actions:

- Mark contacted

- Mark no answer

- Send again

- Change channel

- Open appointment

- Call patient

## Reminder Log

Store:

- Appointment

- Patient

- Channel

- Recipient

- Scheduled time

- Sent time

- Provider

- Provider message ID

- Delivery status

- Error

- Created by

---

# 22. NOTIFICATIONS

Create in-app notifications for:

- Attendance device offline

- Sync failure

- Employee missing check-in

- Employee missing check-out

- Pending attendance adjustment

- Upcoming appointment

- Appointment awaiting confirmation

- Failed reminder

- Appointment conflict

Provide:

- Read and unread status

- Notification center

- Deep links to relevant records

---

# 23. DATABASE DESIGN

Create proper PostgreSQL migrations.

Suggested tables:

- organizations

- clinic_profiles

- user_profiles

- user_roles

- departments

- positions

- employees

- employee_documents

- shifts

- shift_assignments

- attendance_devices

- attendance_device_employee_mappings

- attendance_logs

- attendance_sync_runs

- attendance_daily

- attendance_adjustments

- overtime_requests

- leave_requests

- patients

- service_categories

- treatment_rooms

- appointments

- appointment_reminders

- reminder_attempts

- notifications

- app_settings

- audit_logs

All business tables should include:

- id

- organization_id

- created_at

- updated_at

Where applicable, also include:

- created_by

- updated_by

- deleted_at

Use soft deletion for important business records.

Do not use soft deletion for raw attendance logs unless legally or operationally required.

---

# 24. MULTI-TENANT READINESS

Even though the first client has one clinic, include `organization_id` in the data model.

Do not build SaaS subscriptions or billing yet.

The application should remain easy to extend to multiple clinics later.

All Row Level Security policies must enforce organization isolation.

---

# 25. SECURITY

Implement:

- Supabase Auth

- Role-based access

- Row Level Security

- Protected routes

- Server-side authorization for sensitive actions

- Secure file upload validation

- Input validation with Zod

- Audit logs

- Restricted integration tokens

- No service role key in the frontend

- No plain-text device communication key exposed in the UI

- No secrets committed to source control

Sensitive employee document access must be role-restricted.

Patient contact data must only be accessible to authorized clinic users.

---

# 26. AUDIT LOGGING

Audit important actions:

- Employee created

- Employee updated

- Employee disabled

- Employee document accessed

- Shift changed

- Attendance adjusted

- Monthly attendance finalized

- Appointment created

- Appointment rescheduled

- Appointment cancelled

- Reminder sent

- Reminder failed

- Device configuration changed

- User role changed

- Clinic profile changed

Audit fields:

- User

- Action

- Entity type

- Entity ID

- Previous values

- New values

- Timestamp

- IP address when available

- User agent when available

Audit logs must be read-only in the UI.

---

# 27. SYSTEM SETTINGS

Create settings groups.

## Attendance Settings

- Default grace period

- Default overtime threshold

- Minimum overtime

- Overtime rounding

- Workday calculation method

- Missing punch handling

- Weekend settings

## Appointment Settings

- Default appointment duration

- Appointment interval

- Working hours

- Reminder timing

- Reminder channels

- Confirmation requirement

- No-show settings

## Display Settings

- Date format

- Time format

- Timezone

- Language

- Default page size

## Integration Settings

- Attendance agent token

- Email provider

- SMS provider placeholder

- Zalo provider placeholder

---

# 28. UX REQUIREMENTS

Every page must include:

- Loading state

- Empty state

- Error state

- Permission-denied state

- Confirmation dialog for destructive actions

- Success feedback

- Form validation

- Responsive behavior

Use:

- Drawers for quick details

- Dialogs for focused tasks

- Full pages for detailed profiles

- Tables for operational data

- Cards for dashboards

- Calendars for appointments and shifts

Avoid excessive page reloads.

Use optimistic updates only when safe.

---

# 29. DEMO DATA

Create a realistic seed dataset for a Vietnamese dental clinic.

Clinic:

- One clinic

- One attendance device

- Three treatment rooms

Departments:

- Dentists

- Dental Assistants

- Reception

- Administration

Employees:

- 2 dentists

- 4 dental assistants

- 2 receptionists

- 1 clinic manager

- 1 accountant

Create:

- Employee avatars using placeholders

- Multiple shifts

- Thirty days of sample attendance

- Late attendance cases

- Missing check-out cases

- Overtime cases

- Leave cases

- Twenty patients

- Thirty sample appointments

- Reminder statuses

- Device synchronization history

Use Vietnamese names and realistic Vietnamese phone number placeholders.

Do not use real personal information.

---

# 30. ROUTES

Suggested route structure:

/login

/dashboard

/appointments

/appointments/calendar

/appointments/new

/appointments/:id

/appointments/reminders

/patients

/patients/:id

/employees

/employees/new

/employees/:id

/employees/:id/edit

/departments

/positions

/shifts

/attendance/daily

/attendance/monthly

/attendance/logs

/attendance/adjustments

/attendance/overtime

/attendance/missing

/reports/attendance

/reports/late-early

/reports/overtime

/reports/appointments

/reports/reminders

/system/devices

/system/devices/:id

/system/sync

/system/clinic-profile

/system/users

/system/settings

/system/audit-logs

---

# 31. IMPLEMENTATION PHASES

Do not attempt to build everything in one uncontrolled pass.

## Phase 1 — Foundation

Build:

- Application shell

- Authentication

- Role-based navigation

- Design system

- Supabase connection

- Database migrations

- Clinic profile

- Seed data

## Phase 2 — Employee Management

Build:

- Departments

- Positions

- Employee list

- Employee profile

- Employee documents

- Shift management

## Phase 3 — Attendance Core

Build:

- Devices

- Raw attendance logs

- Employee-device mapping

- Daily attendance engine

- Monthly timesheet

- Attendance adjustments

- Excel export

Use simulated attendance logs first.

## Phase 4 — Sync Agent

Build:

- Device connection proof of concept

- Local configuration

- Log retrieval

- Secure upload

- Duplicate protection

- Heartbeat

- Retry mechanism

- Windows startup

- Agent logging

Do not let device integration block completion of the web application.

## Phase 5 — Appointments

Build:

- Patients

- Appointment calendar

- Appointment CRUD

- Conflict detection

- Appointment statuses

- Daily appointment workflow

## Phase 6 — Reminders

Build:

- Reminder queue

- Manual reminder workflow

- Reminder logs

- Notification rules

- Provider abstraction

## Phase 7 — Finalization

Build:

- Reports

- Audit logs

- Permission testing

- Responsive refinements

- Empty and error states

- Production deployment guide

- User documentation

---

# 32. ACCEPTANCE CRITERIA

The MVP is complete when:

1. An administrator can sign in securely.

2. The administrator can configure the clinic profile.

3. Employees can be created and assigned to departments, positions, and shifts.

4. Each employee can be mapped to an attendance device user ID.

5. Raw attendance logs can be imported through a simulation endpoint.

6. The system calculates daily attendance.

7. The system identifies late arrival, early leave, overtime, and incomplete attendance.

8. Administrators can create attendance adjustments without editing raw logs.

9. Monthly attendance can be viewed and exported to Excel.

10. Device status and synchronization history are visible.

11. Patients can be created with duplicate phone detection.

12. Appointments can be created, rescheduled, confirmed, completed, and cancelled.

13. Appointment conflicts are detected.

14. Reminder tasks are generated according to clinic settings.

15. Receptionists can mark patients as contacted, no answer, or confirmed.

16. The interface works well on desktop and remains usable on mobile.

17. Role permissions are enforced in both UI and database.

18. Important actions appear in audit logs.

19. The app contains realistic demo data.

20. The project includes setup and deployment documentation.

---

# 33. CODE QUALITY REQUIREMENTS

Use:

- Strict TypeScript

- Reusable components

- Clear folder architecture

- Typed database entities

- Centralized validation schemas

- Centralized permissions

- Centralized status constants

- Reusable table components

- Reusable form components

- Error boundaries

- Meaningful naming

- Small focused functions

- Comments only where logic is non-obvious

Avoid:

- `any`

- Giant page components

- Business logic inside UI components

- Hardcoded organization IDs

- Hardcoded device IP addresses

- Hardcoded clinic information

- Hardcoded permissions

- Insecure direct Supabase writes

- Fake reminder success states

- Silent error handling

---

# 34. DOCUMENTATION

Create:

- README.md

- SETUP.md

- DATABASE.md

- ATTENDANCE_ENGINE.md

- SYNC_AGENT.md

- DEPLOYMENT.md

- SECURITY.md

- USER_GUIDE.md

Document:

- Environment variables

- Supabase setup

- Migration commands

- Seed commands

- Local development

- Production deployment

- Sync agent installation

- Device configuration

- Attendance calculation rules

- Reminder provider configuration

- Troubleshooting

---

# 35. INITIAL EXECUTION INSTRUCTION

Start by analyzing the repository.

Then provide:

1. Current repository assessment

2. Proposed architecture

3. Database entity relationship summary

4. Folder structure

5. Implementation roadmap

6. Risks and assumptions

7. Exact list of files to create or modify

After the plan is presented, begin implementation with Phase 1.

Do not merely produce a mockup.

Build a functional application with real Supabase integration, migrations, seed data, validation, authorization, and reusable components.

Do not skip database security.

Do not connect the browser directly to the attendance device.

Use simulated attendance logs until the Sync Agent phase.

At the end of every phase:

- Run TypeScript checks

- Run linting

- Run available tests

- Fix errors

- Summarize completed work

- List pending tasks

- Commit logically grouped changes when Git is available

Approved.

Implement Phase 1 only:

- Application shell

- Authentication

- Role-based navigation

- Dental clinic design system

- Supabase setup

- Initial database migrations

- Clinic profile

- Demo seed data

Do not implement attendance device integration yet.

Run typecheck and lint after implementation, fix all errors, and provide a clear completion report.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/106cf23f-86be-4167-aa18-ca234f4873f4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
