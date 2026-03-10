# Food Rescue Platform - Web Dashboard

The central command center for the **Food Rescue Platform**. This modern web application serves **Admin**, **Dispatcher**, and **NGO** roles, enabling efficient management of food donations, volunteer coordination, and logistics.

## 🌟 Key Features

### 🏢 Admin Dashboard
- **User Management**: Approve/Reject NGO registrations and manage user roles.
- **Analytics Overview**: Visual stats on total food rescued (kg) and CO2 emissions prevented.
- **System Health**: Monitor active volunteers, tasks, and system performance.
- **Audit Logs**: Track all critical system actions.

### 🗺️ Dispatcher Console
- **Live Map View**: Real-time tracking of:
  - 🟢 Available Volunteers
  - 🔴 Pending Tasks
  - 🏢 NGOs and Donors
- **Task Management**: Auto-assign or manually override task assignments.
- **Volunteer Coordination**: Monitor volunteer online/offline status.

### 🤝 NGO Portal
- **Donation Discovery**: View and claim available food donations nearby.
- **Delivery Verification**: Verify incoming deliveries securely.
- **Impact Tracking**: View history of received donations.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: Shadcn UI / Radix Primitives
- **Maps**: @react-google-maps/api
- **State Management**: React Context & Hooks
- **Real-time**: Socket.IO Client
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm or yarn

### Installation

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
   NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key_here
   ```

### Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📱 Mobile Redirect

The web application includes logic to redirect **Donor** and **Volunteer** users to a landing page prompting them to download the mobile app, ensuring they use the platform optimized for their roles.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
