# NGO Mobile App - Feature List

This document provides a comprehensive list of all features currently implemented in the NGO Mobile Application.

## 1. Authentication & Onboarding
- **Multi-Step Registration**: 
    - **Step 1: Basic Info**: Collection of organization name, email, phone, physical address, and password.
    - **Step 2: Legal Verification**: Submission of license type (DARPAN, FCRA, etc.), license number, and document upload (PDF/Images).
- **GPS Integration**: Automatic detection of NGO's current location to pre-fill address and store coordinates for task matching.
- **Login**: Secure email/password authentication.
- **Rejection Handling & Resubmission**: 
    - If rejected by Admin, the app displays the specific rejection reason.
    - NGOs can update their registration details directly within the app, which automatically pre-fills existing data for a seamless resubmission process.

## 2. Donation Discovery & Management
- **Nearby Donations**: Real-time listing of available food donations within proximity to the NGO.
- **Filtering & Categories**: 
    - Quick filters for food types: Veg, Non-Veg, Mixed, Snack, and Vegan.
    - Visual indicators (tags) for food categories on donation cards.
- **Detailed Donation View**: 
    - View donor name, pickup address, and precise quantity (in kg).
    - Status tracking (Available, Claimed, Expiring Soon).
- **Claiming System**: Immediate claiming of available donations with a single tap.

## 3. Claim Tracking & History
- **Active Claims Tab**: Shows donations currently claimed by the NGO that are awaiting pickup.
- **Monthly Overview**: Dashboard showing the total number of claims and total quantity (kg) of food collected/to-be-collected in the current month.
- **Claim History**: Archive of all previous collections, deliveries, and cancellations for record-keeping.
- **Expiry Alerts**: Integrated visual alerts (red text/icons) for donations expiring within 2 hours.

## 4. Verification & Delivery
- **QR Code Verification**: 
    - Generation of a unique QR code/Token for every claimed donation.
    - Secure verification process where NGOs show the QR code to the volunteer/donor for pickup confirmation.
- **Simulation Mode**: Internal verification tool (for NGOs) to simulate the mobile scan for development and testing.
- **Status Progression**: Automated transition of tasks from 'Claimed' to 'Delivered' upon successful verification.

## 5. NGO Dashboard & Profile
- **Status Monitoring**: Real-time visibility into account approval status (Pending, Approved, Rejected).
- **Organization Profile**: View and manage core organization details.
- **Storage Management**: Visual progress bar showing total storage capacity vs. current usage (kg).
- **Location Updates**: Ability to update the NGO's primary GPS location and address at any time.

## 6. Technical & UI Features
- **Responsive Design**: Prevents UI overflows on various screen sizes (using Flexible, Wrap, and Ellipsis).
- **Platform Compatibility**: Supports operations on both Physical Android devices and Web browsers (limited geocoding on web).
- **Local Cache & Offline Recovery**: Basic state management with Riverpod to maintain UI consistency during network fluctuations.
- **CORS-Aware Networking**: Pre-configured for local development and production API environments.
