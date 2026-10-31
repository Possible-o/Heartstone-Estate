# Heartstone Estate

Heartstone Estate is a full-stack real estate website for residential properties in Lagos, Nigeria. Visitors can browse homes, view property details, create accounts, save favourites, and request inspections. There's also an admin dashboard for managing listings, property images, inspection requests, and enquiries.

The frontend uses HTML, CSS, and vanilla JavaScript. The backend runs on Node.js and Express, with MongoDB for data storage.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | bcryptjs, express-session, connect-mongo |
| Security | Helmet, express-rate-limit |
| Email | Nodemailer |
| Image uploads | Multer, Sharp |

## Features

### Property listings

Visitors can browse properties, search for homes, and open listings to see their details. Admins can add, edit, and remove properties, and their changes are reflected on the website.

### User accounts

Registered users can sign in, save favourite properties, and request inspections. Login sessions are managed by Express and stored in MongoDB.

### Admin dashboard

Administrators can:

- Add, edit, and delete properties.
- Upload multiple images for each listing.
- Review inspection requests.
- Manage customer enquiries.

Admin accounts are stored in a separate collection and created using a backend script, not a public signup page.

### Password reset

Users can request a password reset link by email. The backend stores a hash of the reset token, and each link expires after 15 minutes. Reset links are single-use, and resetting a password invalidates existing user sessions.

## Security

The backend includes password hashing with bcryptjs, server-side validation, role-based route protection, HTTP-only session cookies, session regeneration after login, rate limiting on sensitive endpoints, and security headers through Helmet. Credentials and other secrets are configured through environment variables.

## Project Structure

```text
Heartstone_Estate/
├── backend/
│   ├── models/
│   ├── scripts/
│   │   └── create-admin.js
│   ├── heartstone-mailer.js
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── css/
│   ├── images/
│   ├── js/
│   └── index.html
├── .gitignore
└── README.md
```

## Running Locally

You'll need Node.js 22.x, npm, and a MongoDB connection.

Clone the repository and install the backend dependencies:

```bash
git clone https://github.com/Possible-o/Heartstone-Estate.git
cd Heartstone-Estate/backend
npm install
```

Create a `.env` file inside `backend/` and add your own configuration values:

```env
MONGODB_URI=
SESSION_SECRET=
SMTP_USER=
SMTP_APP_PASSWORD=
APP_BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

Start the server:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The `.env` file is excluded from Git and should never be committed.

## Creating an Admin Account

From the `backend/` directory, run:

```bash
npm run create-admin
```

The script prompts for the administrator's name, email, and password, validates the details, and saves the account in the `admins` collection.

## Deployment

The application is being prepared for deployment on Render, using MongoDB Atlas for the database.

Property images are currently stored on the local filesystem. Persistent object or image storage will be needed to keep new uploads reliably available in production.

## About the Project

I built this to work through the parts of a full-stack application that go beyond the interface: connecting a frontend to real backend routes, managing user and admin access, storing sessions, working with MongoDB, and handling password recovery.

Deployment and production testing are the next steps.
