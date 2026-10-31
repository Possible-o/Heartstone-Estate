# Heartstone Estate

Heartstone Estate is a full-stack real estate web application designed for residential properties in Lagos, Nigeria. It provides a platform for browsing properties, managing user accounts, saving favourite listings, and requesting property inspections.

The application also includes a protected administrative dashboard for managing properties, images, inspection requests, and customer enquiries.

**Live Website:** https://heartstone-estate.onrender.com

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Authentication | bcryptjs, express-session, connect-mongo |
| Security | Helmet, express-rate-limit, server-side validation |
| Image Management | Cloudinary, Multer, Sharp |
| Email | Nodemailer |
| Deployment | Render |

## Features

### Property Listings

- Browse residential properties available for sale or rent.
- Search and explore property listings.
- View property descriptions, prices, locations, features, and images.
- Access property information across desktop, tablet, and mobile devices.
- Display updates made by administrators.

### User Authentication

- User registration and login.
- Secure password hashing using bcryptjs.
- Session-based authentication.
- Protected user dashboard.
- Favourite property management.
- Property inspection requests.
- Password recovery through email.

### Administrative Dashboard

The administrative dashboard allows authorised administrators to:

- Create, edit, and delete property listings.
- Upload multiple property images.
- Select and update a property's cover image.
- Manage images stored in Cloudinary.
- Mark properties as featured.
- Review and manage inspection requests.
- View and manage customer enquiries.

Administrator accounts are created through a backend script and stored separately from regular user accounts. Public administrator registration is not available.

### Property Image Management

Property images are processed using Multer and Sharp before being uploaded to Cloudinary.

The image management system supports multiple images per property, cover-image selection, and image removal. Property images are stored in Cloudinary rather than relying on the application's local filesystem.

### Password Recovery

Registered users can request password reset links through email.

Reset tokens are securely hashed, expire after 15 minutes, and can only be used once. Successful password resets also invalidate existing user sessions.

## Security

Heartstone Estate includes several security measures:

- Password hashing using bcryptjs.
- Server-side input validation.
- Session-based authentication with HTTP-only cookies.
- MongoDB-backed session storage.
- Role-based access protection.
- Separate administrator authentication.
- Rate limiting on sensitive endpoints.
- HTTP security headers using Helmet.
- Protected administrative API routes.
- Environment variables for sensitive configuration.

Authentication and authorisation are enforced by the backend rather than relying solely on frontend restrictions.

## Project Structure

```text
Heartstone-Estate/
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

## Local Installation

### Requirements

- Node.js 22.x
- npm
- MongoDB connection
- Cloudinary account
- SMTP credentials for email functionality

### Setup

Clone the repository:

```bash
git clone https://github.com/Possible-o/Heartstone-Estate.git
cd Heartstone-Estate
```

Install backend dependencies:

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory and configure the required environment variables.

The application requires a MongoDB connection, a secure session secret, and Cloudinary configuration. Email credentials are required for password recovery.

Example application settings:

```env
MONGODB_URI=
SESSION_SECRET=
CLOUDINARY_URL=
CLOUDINARY_CLOUD_NAME=
SMTP_USER=
SMTP_APP_PASSWORD=
APP_BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

Keep all credentials private. Never commit the `.env` file or actual secret values to GitHub.

Start the development server:

```bash
npm run dev
```

Or start normally:

```bash
npm start
```

Open:

http://localhost:3000

## Administrator Account Creation

Administrator accounts are created through a dedicated backend script.

From the `backend` directory, run:

```bash
npm run create-admin
```

Follow the prompts to provide the administrator's required information.

The account is stored in the separate administrator collection in MongoDB.

## Deployment

Heartstone Estate is deployed on Render with MongoDB Atlas providing database storage and Cloudinary providing persistent image hosting.

The deployment uses environment variables for database connectivity, session security, Cloudinary integration, and email configuration.

**Production URL:** https://heartstone-estate.onrender.com

## Project Objectives

Heartstone Estate was developed to demonstrate the design and implementation of a complete real estate web application, including:

- Responsive frontend development.
- RESTful backend API integration.
- Database design and management.
- Secure user and administrator authentication.
- Property and image management.
- Inspection request workflows.
- Email-based password recovery.
- Cloud deployment and persistent data storage.

## Project Status

The application has been deployed and includes its core property management, authentication, inspection request, enquiry management, and Cloudinary image-management functionality.
