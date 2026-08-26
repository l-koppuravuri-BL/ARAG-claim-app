# Codebase Walkthrough

This document provides a walkthrough of the **ARAG Claims Tracker** codebase, detailing the backend and frontend components.

---

## Backend Codebase (Python 3.12)

The backend is designed as a serverless REST API that runs inside AWS Lambda. For developers coming from a **Java** background, the architecture maps closely to standard Java EE or Spring Boot patterns.

### 1. Unified Request Entry & Routing: `backend/index.py`
* **Java Analogy**: A Spring Boot `@RestController` or a Java Servlet mapping requests to controller methods.
* **Purpose**: This is the entry point for the Lambda function. When API Gateway routes an HTTP request to Lambda, it invokes the `handler(event, context)` function.
* **Key Mechanics**:
  * **Event Parsing**: The `event` dictionary represents the incoming HTTP request (analogous to `HttpServletRequest`). It extracts the HTTP method (`GET`, `POST`, etc.), query parameters, path parameters (like the claim `id`), and the `Authorization` header.
  * **CORS Preflight**: Intercepts `OPTIONS` requests and returns CORS headers to allow the frontend to communicate with the API from different domains.
  * **Routing**: Uses simple conditional checks (`if/elif`) matching on HTTP method and path to route requests to the database functions in `claims.py`.
  * **Response Formatting**: Returns a JSON string with proper headers. The `DecimalEncoder` class is used to serialize DynamoDB numeric types (which use Python's `Decimal` type) into normal JSON floats/integers.
  * **Development HTTP Server**: Contains a `__main__` block that starts Python's built-in `HTTPServer` module on port `3001` to mock the Lambda environment locally.

### 2. Security & Authentication Filter: `backend/auth.py`
* **Java Analogy**: A custom Spring Security filter or a servlet `Filter` that intercepts requests to authenticate users.
* **Purpose**: Extracts, validates, and verifies the Google OAuth ID Token (JWT) sent by the browser.
* **Key Mechanics**:
  * **Bypass in Development**: If the backend detects it is running locally (`NODE_ENV == "development"`) and receives a token matching `"dev-token"`, it automatically logs in a mock user (`dev-user@example.com`), enabling test-driven development without internet access.
  * **Token Verification**: Sends an HTTP request to Google's Tokeninfo endpoint (`https://oauth2.googleapis.com/tokeninfo?id_token=<token>`) using standard `urllib`. If the token is valid, it retrieves user attributes (email, name, picture).
  * **User Allowlist Verification**: Compares the email against the authorized lists configured in the environment (`ALLOWED_EMAILS` or `TENANT_MAP`). If the email is not allowed, it raises a `PermissionError` (HTTP 403 Forbidden).
  * **Multi-Tenancy Mapping**: Groups users into logical tenants based on the `TENANT_MAP` configuration (allowing multiple family members to share the same claims view).

### 3. Data Access & Persistence: `backend/claims.py`
* **Java Analogy**: A Database Access Object (DAO) or a Spring Data Repository (e.g., `ClaimsRepository`).
* **Purpose**: Manages read, write, update, and delete operations on claims.
* **Key Mechanics**:
  * **Local Fallback**: If the environment variable `USE_LOCAL_DB` is `true` (default during local testing), the codebase bypasses AWS DynamoDB and reads/writes from a local JSON file (`backend/local_db.json`). This ensures developers can run the app offline with zero setup.
  * **AWS Integration**: When deployed, it uses the **Boto3 SDK** (the AWS SDK for Python, similar to AWS SDK for Java) to interface with DynamoDB.
  * **Partition Key Isolation**: Every read, write, update, and delete query enforces the `userId` partition key, ensuring complete tenant isolation.
  * **Floating-Point Conversion**: DynamoDB requires decimal numbers to be stored as `Decimal` types. This module handles the conversion of Python floats (sent by the frontend) to `Decimal` types before saving, and vice versa.

---

## Frontend Codebase (Vanilla SPA)

The frontend is a lightweight Single Page Application (SPA). To keep deployment simple, cost-effective, and fast, it is built **without complex build tools** (no Webpack, Vite, Babel, or npm dependencies).

### 1. User Interface: `frontend/index.html`
* **Purpose**: Defines the layout, modals, navigation, and structure of the application.
* **Key Sections**:
  * **Auth Screen**: Shown by default. Contains the Google Sign-In container and the Local Dev bypass button.
  * **Dashboard Layout**: Includes the stats grid cards, filter controls (search input, patient select list, and status tabs), and container divs for claims.
  * **Modals**: Multi-purpose modals for entering/editing claim details and displaying detailed read-only claims specifications (deductible calculations, adjuster feedback).
  * **Asset Imports**: Integrates modern typography fonts (Google Fonts *Outfit* and *Plus Jakarta Sans*), iconography (FontAwesome), and the Google Identity Services Client Library.

### 2. Styles and Animations: `frontend/styles.css`
* **Purpose**: Defines the design system, animations, responsive grid layouts, and color themes.
* **Key Concepts**:
  * **CSS Custom Variables**: Defines color tokens (e.g., `--accent-gold`, `--bg-dark-base`, `--card-dark-bg`), borders, shadows, and fonts in one central place.
  * **Glassmorphism**: Uses premium visual styles (acrylic blur backdrops, thin translucent borders) for cards and modals.
  * **Transitions**: Smooth animations for hover states, modal fade-ins, status transitions, and progress bar updates.

### 3. Application State & Orchestration: `frontend/app.js`
* **Purpose**: Manages client-side routing, auth callbacks, form validation, and renders UI updates.
* **Core Functions**:
  * **State management**: Tracks the logged-in user details, active auth token, current claims list, active filter statuses, and view layout (grid vs. table).
  * **Google Auth Handler**: Implements the callback method `handleCredentialResponse` triggered by the Google Sign-In SDK. Stores the JWT token, fetches claims, and shifts views.
  * **API Client**: Implements reusable wrapper functions using the native browser `fetch` API. It dynamically injects the `Authorization: Bearer <JWT>` header in all requests.
  * **Dynamic Calculations**: Computes aggregate statistics (Total Invoiced, Total Reimbursed, Pending portions, and the overall Reimbursement Recovery Rate %) on the fly as filters change.

---

## Dependencies & Libraries Used

### Backend Dependencies
The backend codebase uses **zero external python packages** in its deployment ZIP.
* **Python Built-in Modules**:
  * `urllib.request` & `urllib.error`: For performing HTTP requests to Google APIs without external libraries (like `requests`).
  * `json`: For formatting request/response bodies.
  * `uuid`: For generating random UUIDs for new claims.
  * `datetime` & `timezone`: For capturing standardized timestamps in ISO-8601 format.
  * `os`: For retrieving environment configurations (database names, client IDs, allowlists).
* **AWS Provided**:
  * `boto3`: The AWS SDK for Python. This is pre-installed in all AWS Lambda runtimes, meaning it does not need to be packaged in the backend deployment ZIP.

### Frontend Dependencies
All dependencies are loaded directly via CDN:
1. **Google Identity Services SDK** (`https://accounts.google.com/gsi/client`): Used to render the Google Login button and issue JWT tokens.
2. **Font Awesome 6.4.0** (via cdnjs): Provides clean vector icons for the user interface.
3. **Google Fonts (Outfit & Plus Jakarta Sans)**: Premium modern typography.
