# Heartstone Estate

**A full-stack real estate platform for residential property discovery and management in Lagos, Nigeria.**

Heartstone Estate is a web application built to provide a structured experience for exploring residential properties, managing listings, and coordinating property inspection requests.

The platform combines a responsive frontend with a Node.js backend, MongoDB persistence, session-based authentication, and separate administrative access.

## Overview

Heartstone Estate addresses two aspects of residential property management: helping prospective clients discover suitable properties and providing administrators with tools to manage listings and customer interactions.

The application supports property browsing, account management, saved properties, inspection requests, and administrative operations through dedicated user interfaces.

The system is built with an emphasis on maintainability, clear separation of responsibilities, server-side validation, and secure authentication practices.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | Express Session, Connect Mongo, bcryptjs |
| Security | Helmet, Express Rate Limit, server-side validation |
| Email | Nodemailer, Gmail SMTP |
| Image Processing | Multer, Sharp |
| Version Control | Git, GitHub |
| Deployment Target | Render |

## Core Features

### Property Discovery

- Browse residential properties available for sale or rent.
- Explore individual property listings and detailed information.
- Search and filter available properties.
- Navigate property information through a responsive interface.

### User Accounts

- Account registration and authentication.
- Personalized user dashboard.
- Favourite property management.
- Property inspection requests.
- Password recovery through email verification links.
- Session-based access to protected functionality.

### Administrative Management

- Dedicated administrator authentication.
- Property listing creation, modification, and deletion.
- Multiple-image property uploads.
- Inspection request management.
- Customer enquiry management.
- Restricted access to administrative functionality.

## Authentication and Security

Heartstone Estate implements server-side authentication using Express sessions, with session data stored in MongoDB.

**Authentication architecture**

Regular users and administrators are maintained in separate MongoDB collections and authenticated through their respective models.

Administrator accounts are created through a restricted backend script rather than a publicly accessible registration interface.

**Password protection**

Passwords are hashed using bcryptjs before storage. Authentication compares submitted credentials against stored password hashes rather than retaining plaintext passwords.

**Password recovery**

The password-reset workflow uses cryptographically generated tokens with a 15-minute expiration period. Tokens are stored as hashes and invalidated after successful use.

Password resets also invalidate previously authenticated user sessions through session-version checks.

**Additional protections**

- Server-side input validation.
- Request rate limiting.
- HTTP security headers through Helmet.
- HTTP-only session cookies.
- Role-based access restrictions.
- Environment-based secret management.
- Session regeneration during authentication.

These controls provide multiple layers of protection, although security remains an ongoing process requiring testing, maintenance, and configuration reviews.

## Application Architecture

The project separates the presentation layer, backend application logic, and database models.

```text
Heartstone_Estate/
├── backend/
│   ├── models/
│   │   ├── Admin.js
│   │   ├── User.js
│   │   ├── Property.js
│   │   ├── InspectionRequest.js
│   │   └── Enquiry.js
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
│   ├── index.html
│   ├── signin.html
│   ├── createaccount.html
│   ├── properties.html
│   ├── property.html
│   ├── user-dashboard.html
│   ├── admin-login.html
│   └── admin.html
├── .gitignore
└── README.md
```

### Backend

The Express application handles HTTP requests, authentication, session management, validation, database operations, and administrative functionality.

Mongoose models define the structure of application data and provide the interface for MongoDB operations.

### Frontend

The frontend uses HTML, CSS, and JavaScript without a frontend framework. JavaScript modules handle interface interactions, form submissions, property presentation, and communication with backend endpoints.

### Database

MongoDB stores application data, including user accounts, administrator accounts, property records, inspection requests, and enquiries.

Session persistence is managed separately using Connect Mongo.

## Getting Started

### Prerequisites

- Node.js 22.x
- npm
- MongoDB Atlas or another compatible MongoDB instance
- SMTP credentials for password-reset functionality

### Installation

Clone the repository:

```bash
git clone https://github.com/Possible-o/Heartstone-Estate
```

Install dependencies:

```bash
npm install
```

Create a `.env` file inside the `backend` directory and configure the required environment variables.

Start the development server:

```bash
npm run dev
```

Alternatively, start the application normally:

```bash
npm start
```

Open the application at:

`http://localhost:3000`

## Environment Variables

The backend uses environment variables to separate configuration and credentials from source code.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | Secret used for session signing |
| `SMTP_USER` | Email account used for password-reset messages |
| `SMTP_APP_PASSWORD` | SMTP authentication credential |
| `APP_BASE_URL` | Base URL used when generating password-reset links |
| `PORT` | HTTP server port |
| `NODE_ENV` | Application environment |

Actual environment files and credentials are excluded from version control.

## Administrator Provisioning

Administrators are created using a dedicated command:

```bash
npm run create-admin
```

The script prompts for administrator details, validates password requirements, hashes the password, and stores the account in the dedicated `admins` collection.

Administrative registration is not exposed as a public application feature.

## Engineering Considerations

### Authentication Boundaries

The application distinguishes standard user sessions from administrative sessions. Protected routes enforce authentication and authorization on the server rather than relying exclusively on frontend navigation controls.

### Session Lifecycle

Authentication regenerates sessions to reduce session fixation risks. Session-version checks support invalidation of existing user sessions following a password reset.

### Password Recovery

Password-reset tokens are time-limited, single-use credentials. Storing their hashes instead of raw token values reduces exposure if database records are compromised.

### Data Management

Dedicated Mongoose models separate the application's primary data entities, supporting consistent validation and database access patterns.

### Responsive Design

The interface is designed for desktop and mobile screen sizes, with responsive layouts and navigation.

## Deployment

**Target platform:** Render

**Database:** MongoDB Atlas

Production deployment requires environment configuration, database network access, HTTPS-aware session settings, and persistent storage for uploaded property images.

The deployment URL will be added after the application is published and verified.

## Project Status

The application has been developed and tested locally. Production deployment and final deployment-specific checks are in progress.

## Future Improvements

- Persistent cloud storage for uploaded property images.
- Automated integration and regression testing.
- Expanded property search and filtering capabilities.
- Application monitoring and structured error reporting.
- Improved administrative reporting and analytics.

## Author

Developed as a full-stack web development project demonstrating practical experience with frontend engineering, REST-style backend APIs, MongoDB data management, authentication, and administrative workflows.