
  # Loan Management System Blueprint

  This is a code bundle for Loan Management System Blueprint. The original project is available at https://www.figma.com/design/63SuZxAmMSIg14TW4XAzJR/Loan-Management-System-Blueprint.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## API server (MySQL)

  This project now uses a MySQL-backed API server instead of sample data.

  1. Install dependencies (already covered above).
  2. Create a database (example name: `lms`).
  3. Set environment variables (see below).
  4. Start the API server:

    - `npm run server`

  The server listens on `http://localhost:5174` by default.

  ### Required environment variables

  - `DB_HOST` (e.g., `localhost`)
  - `DB_USER` (e.g., `root`)
  - `DB_PASSWORD`
  - `DB_NAME` (e.g., `lms`)
  - `DB_PORT` (optional, default `3306`)
  - `API_PORT` (optional, default `5174`)

  The server will auto-create tables on startup. A reference schema is in [server/schema.sql](server/schema.sql).

  ### Default admin login

  On first startup, a default admin user is created:

  - Email: `admin@lms.com`
  - Password: `admin123`

  ### Frontend API URL

  You can point the frontend at a different API URL by setting:

  ```
  VITE_API_URL=http://localhost:5174
  ```
  