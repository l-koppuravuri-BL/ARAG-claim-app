# ARAG Health Insurance Claims Tracker

A secure, cost-effective, and modern serverless web application for logging and tracking your health insurance claims. 

Designed specifically to address limitations in standard insurance apps, this portal allows you to track invoiced vs. approved amounts, recovery rates, and insurance adjuster feedback. Access is fully restricted to your personal Gmail account using Google OAuth.

---

## Architecture Overview

1. **Frontend**: A high-performance, single-page application built using vanilla HTML, ES6 JavaScript, and custom modern CSS. It has no build dependencies or heavy framework installation requirements, and features a gorgeous dark-theme dashboard.
2. **Backend**: A serverless REST API written in Python running on AWS Lambda. It uses a custom Google JWT token verification system and has **zero package dependencies**, keeping deployments fast, simple, and clean.
3. **Database**: Amazon DynamoDB, a fully managed NoSQL database configured with Pay-Per-Request (On-Demand) billing.
4. **Hosting**: Hosted on AWS S3 + CloudFront (for the frontend) and API Gateway + Lambda (for the backend), resulting in an operating cost of **$0.00/month** under standard single-user usage.

---

## 🔑 Step 1: Set Up Google OAuth Credentials

Before running the application, you need to create a free Google OAuth Client ID to manage secure login:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `arag-claims-tracker`).
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   - Choose **External** user type.
   - Fill out the App Name and developer email.
   - Under **Scopes**, you do not need to add any special scopes (default `email`, `profile`, `openid` are sufficient).
   - Under **Test Users**, add the specific Gmail address(es) that should be authorized to access the application.
4. Navigate to **APIs & Services** > **Credentials**:
   - Click **+ Create Credentials** > **OAuth client ID**.
   - Select **Web application** as the Application type.
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost:8000` (for local development frontend)
     - The HTTPS domain of your deployed application later.
   - Click **Create**.
5. Copy the generated **Client ID** (you will use this in the frontend and backend).

---

## 💻 Step 2: Local Development & Testing

You can run the entire stack locally on your computer with **zero AWS configuration**! The backend is designed to run a local mock server and save claims directly to a file (`backend/local_db.json`).

### 1. Start the Backend API
The backend includes a built-in development server that runs on standard Python libraries.

Execute the following in your terminal from the project root:
```powershell
# Run the local python server on port 3001
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe" backend/index.py
```
*(Note: If you have Python added to your system path, you can just run `python backend/index.py`)*

Once started, the backend will state:
`🚀 [DEV SERVER] Claims Tracker Python API at http://localhost:3001`

### 2. Configure the Frontend
1. Open the [frontend/app.js](file:///C:/Users/l.koppuravuri/.gemini/antigravity-ide/scratch/arag-claims-tracker/frontend/app.js) file.
2. Replace `"YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com"` with your actual Google Client ID from Step 1.
3. Ensure `API_BASE` is set to `"http://localhost:3001"`.

### 3. Start the Frontend Web Server
Since the frontend has no build chain, you can serve it instantly using Python's built-in HTTP server module:

Open a new terminal window and run:
```powershell
# Run local HTTP server from the frontend folder on port 8000
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe" -m http.server 8000 --directory frontend
```

### 4. Open and Test!
- Open your browser and navigate to [http://localhost:8000](http://localhost:8000).
- Since you are running locally, a **"Skip to Development Dashboard"** button will appear. Clicking this bypasses the Google Auth check and uses a developer account (`dev-user@example.com`), allowing you to test the dashboard, add claims, edit them, and inspect details instantly.
- To test the full login flow, log out and log in with your Gmail credentials.

---

## ☁️ Step 3: Deploying to AWS

When you are ready to deploy to AWS, use the AWS SAM CLI to provision your serverless infrastructure.

### Prerequisites
- Install the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
- Run `aws configure` to set up your AWS credentials.

### Deploying the Backend & Database
1. In the project root folder, build the template:
   ```bash
   sam build
   ```
2. Deploy the application:
   ```bash
   sam deploy --guided
   ```
3. During the guided prompt, provide:
   - **Stack Name**: `arag-claims-tracker`
   - **AWS Region**: e.g., `eu-central-1` (or your preferred region)
   - **GoogleClientId**: Your Google Client ID from Step 1.
   - **AllowedEmails**: A comma-separated list of emails allowed to log in (e.g. `your.email@gmail.com`).
4. Save the configuration to `samconfig.toml` when prompted.
5. Once completed, SAM will output the **`ApiUrl`** (e.g. `https://xxxx.execute-api.eu-central-1.amazonaws.com`). Copy this URL.

### Deploying the Frontend
1. Open [frontend/app.js](file:///C:/Users/l.koppuravuri/.gemini/antigravity-ide/scratch/arag-claims-tracker/frontend/app.js).
2. Update the `API_BASE` value to point to your new AWS `ApiUrl` (with no trailing slash, e.g. `https://xxxx.execute-api.eu-central-1.amazonaws.com`).
3. Upload the files in the `frontend/` directory (`index.html`, `app.js`, `styles.css`) to:
   - An **AWS S3 Bucket** configured for static website hosting, fronted by **AWS CloudFront** for SSL (recommended).
   - Alternatively, you can use **AWS Amplify Console** to host it directly from your GitHub repository for automatic builds and deployments on Git push.
4. Remember to add your deployed frontend URL (e.g., `https://your-app.amplifyapp.com` or `https://yourdomain.com`) to the **Authorized JavaScript origins** list in the Google Cloud Console credential settings created in Step 1.
