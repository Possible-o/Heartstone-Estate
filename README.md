Heartstone Estate

Heartstone Estate is a full-stack real estate website built around residential properties in Lagos, Nigeria. It allows visitors to explore available homes, view property details, create accounts, save properties, and request inspections.

The project also includes an admin dashboard for managing property listings, uploaded images, inspection requests, and customer enquiries.

I built the frontend with HTML, CSS, and vanilla JavaScript, while Node.js and Express handle the backend. MongoDB stores the application's data.

Tech Stack

Frontend: HTML, CSS, JavaScript

Backend: Node.js, Express.js

Database: MongoDB, Mongoose

Other tools: bcryptjs, express-session, connect-mongo, Helmet, Nodemailer, Multer, Sharp

Features

Property Listings

Users can browse properties, search for available homes, and open individual listings to see more information.

Property information is managed through the admin dashboard, so changes to listings are reflected on the website.

User Accounts

Users can register, sign in, manage their favourite properties, and request inspections.

Authentication is handled on the server using Express sessions, with session data stored in MongoDB.

Admin Dashboard

Administrators can:

Add, edit, and delete property listings.

Upload multiple images for a property.

View and manage inspection requests.

Manage customer enquiries.

Admin accounts are stored separately from regular user accounts. New administrators are created through a backend script rather than a public registration form.

Password Reset

Users who forget their passwords can request a reset link by email.

The backend generates a random token, stores its hash in MongoDB, and sends the reset link using Nodemailer. Each link expires after 15 minutes and can only be used once.

Resetting a password also invalidates existing user sessions.

Security

A few measures I've implemented include:

Password hashing with bcryptjs.

Server-side input validation.

Role-based access control for protected routes.

HTTP-only session cookies.

Session regeneration after login.

Rate limiting on sensitive endpoints.

Security headers using Helmet.

Environment variables for database credentials and other secrets.

Project Structure

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

The backend contains the Express server, database models, authentication logic, and API endpoints.

The frontend contains the website pages, stylesheets, images, and JavaScript files.

Running Locally

You'll need Node.js 22.x, npm, and a MongoDB connection.

Clone the repository:

git clone https://github.com/Possible-o/Heartstone-Estate
cd Heartstone_Estate/backend

Install the dependencies:

npm install

Create a .env file in the backend directory and provide the required configuration:

MONGODB_URI=
SESSION_SECRET=
SMTP_USER=
SMTP_APP_PASSWORD=
APP_BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development

Start the server:

npm start

The application should be available at:

http://localhost:3000

The .env file is excluded from Git, so credentials aren't included in the repository.

Creating an Admin Account

Admin accounts are created from the backend terminal:

npm run create-admin

The script asks for an email address, full name, and password. It validates the information and saves the administrator to the separate admins collection.

Deployment

The application is currently being prepared for deployment on Render, with MongoDB Atlas handling database storage.

Property image uploads currently use local file storage. Persistent cloud storage will be needed to keep uploaded images available reliably after deployment.

About the Project

I worked on this project to put together a complete web application rather than just a static website.

The backend was a major part of the work, particularly connecting authentication to MongoDB, separating user and admin access, managing sessions, and implementing password recovery.

The project is still being improved, with deployment and final testing underway.