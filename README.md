
  # Loan Management System 

    ## Quick start guide

    1. Clone the repository.
    2. Install dependencies:

      ```
      npm install
      ```

    3. Create a MySQL database (example name: `lms`).
    4. Create a `.env` file in the project root with the values below.
    5. Start the API server:

      ```
      npm run server
      ```

    6. Start the frontend:

      ```
      npm run dev
      ```

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

  Example `.env`:

  ```
  DB_HOST=localhost
  DB_USER=root
  DB_PASSWORD=
  DB_NAME=lms
  DB_PORT=3306
  API_PORT=5174
  VITE_API_URL=http://localhost:5174
  ```

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
  