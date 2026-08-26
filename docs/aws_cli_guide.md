# AWS CLI & AWS Console Guide

This is a beginner-friendly guide for configuring the AWS CLI (Command Line Interface), using CLI commands to monitor and manage your application's resources, navigating the AWS Web Console, and cleaning up your AWS resources when finished.

---

## 1. Setting Up the AWS CLI

The AWS CLI allows you to control AWS services from your terminal.

### Step 1: Install the AWS CLI
* **Windows**: Download and run the [AWS CLI MSI Installer](https://awscli.amazonaws.com/AWSCLIV2.msi).
* **Verify Installation**: Open a command prompt or PowerShell window and run:
  ```powershell
  aws --version
  ```
  *(You should see output starting with `aws-cli/2.x.x`)*

### Step 2: Configure Credentials
To link the CLI to your AWS account:
1. Log into the AWS Console. Go to the **IAM Console** -> **Users** -> Select your username -> **Security credentials** tab.
2. Under **Access keys**, click **Create access key** (select "Command Line Interface (CLI)"). Copy the **Access Key ID** and **Secret Access Key**.
3. In your terminal, run:
   ```powershell
   aws configure
   ```
4. Enter the details when prompted:
   * **AWS Access Key ID**: Paste your Access Key ID.
   * **AWS Secret Access Key**: Paste your Secret Access Key.
   * **Default region name**: e.g., `eu-central-1` (Must match the region where you deploy).
   * **Default output format**: `json`

---

## 2. Managing Amazon S3 (Frontend Files)

If you host your static frontend files in an Amazon S3 bucket, use these commands to upload and view them.

### Create a new S3 Bucket
*(Bucket names must be globally unique across all of AWS)*
```powershell
aws s3 mb s3://your-unique-claims-tracker-frontend
```

### Upload Frontend Files
Copy all files inside the `frontend/` folder (`index.html`, `app.js`, `styles.css`) to your bucket:
```powershell
aws s3 cp frontend/ s3://your-unique-claims-tracker-frontend/ --recursive
```

### View Files in the Bucket
```powershell
aws s3 ls s3://your-unique-claims-tracker-frontend/
```

### Update (Sync) Changes
If you modify `app.js` or `styles.css` locally, sync the folder to upload *only* the modified files:
```powershell
aws s3 sync frontend/ s3://your-unique-claims-tracker-frontend/
```

---

## 3. Managing Amazon DynamoDB (Database)

Interact directly with the `ClaimsTable` database to inspect saved claims.

### Describe the Table Structure
Confirm the table status and key schema details:
```powershell
aws dynamodb describe-table --table-name ClaimsTable
```

### Scan the Table (List All Claims)
Retrieves all items stored in the table. 
```powershell
aws dynamodb scan --table-name ClaimsTable
```

### Query Claims for a Specific User
Querying is faster and more cost-effective than scanning because it uses the partition key index.
```powershell
# Query for user "dev-user@example.com"
aws dynamodb query `
  --table-name ClaimsTable `
  --key-condition-expression "userId = :uid" `
  --expression-attribute-values '{\":uid\": {\"S\": \"dev-user@example.com\"}}'
```
*(Note: In PowerShell, the backtick `` ` `` is the line-continuation character. In Linux/macOS, use the backslash `\` instead)*

### Add a Claim via CLI (Write Test)
Write a mock claim directly into the database:
```powershell
aws dynamodb put-item `
  --table-name ClaimsTable `
  --item '{"userId": {"S": "cli-test@example.com"}, "id": {"S": "cli-claim-999"}, "provider": {"S": "Dr. Smith (Vision)"}, "description": {"S": "New glasses prescription"}, "amountSubmitted": {"N": "250.00"}, "status": {"S": "Submitted"}, "createdAt": {"S": "2026-08-26T12:00:00Z"}, "updatedAt": {"S": "2026-08-26T12:00:00Z"}}'
```

---

## 4. Managing AWS Lambda (API Backend)

List your function, invoke it to test the API route, and read its debug print logs.

### List Deployed Lambda Functions
Find the exact name of your deployed claims tracker function (it usually contains your SAM stack name):
```powershell
aws lambda list-functions --query "Functions[?contains(FunctionName, 'ClaimsFunction')].FunctionName"
```

### Invoke the Lambda Function (Manual Test)
You can trigger the Lambda function directly from the CLI. This sends a mock request payload representing an HTTP GET request to `/claims`:
```powershell
# Create a payload file
'{"httpMethod": "GET", "path": "/claims", "headers": {"Authorization": "Bearer dev-token"}}' | Out-File -Encoding utf8 payload.json

# Invoke the Lambda
aws lambda invoke `
  --function-name Your-Deployed-ClaimsFunction-Name `
  --payload fileb://payload.json `
  response.json

# Read the response
cat response.json
```

---

## 5. Fetching CloudWatch Logs (Debugging)

When your Lambda code runs `print()` statements or encounters exceptions, they are sent to AWS CloudWatch Logs.

### List Log Streams
Find the latest log streams (where execution outputs are grouped):
```powershell
aws logs describe-log-streams `
  --log-group-name "/aws/lambda/Your-Deployed-ClaimsFunction-Name" `
  --order-by "LastEventTime" `
  --descending `
  --limit 3
```

### Fetch Log Output
Print the actual print statements and error traces from a log stream:
```powershell
aws logs get-log-events `
  --log-group-name "/aws/lambda/Your-Deployed-ClaimsFunction-Name" `
  --log-stream-name "Replace-With-Log-Stream-Name-From-Previous-Command" `
  --limit 50
```

---

## 6. Navigating the AWS Console UI (Web Browser)

If you prefer using the AWS Web Console interface instead of the command line, here is how to view your resources.

1. Open the [AWS Management Console](https://console.aws.amazon.com/) and sign in.

### Viewing Database Items (DynamoDB Console)
1. Search for **DynamoDB** in the top search bar.
2. In the left sidebar, click **Tables** -> **Explore items**.
3. Select **ClaimsTable** from the tables list.
4. You will see a list of all claim items. You can click on individual rows to inspect the raw JSON structure, edit values, or delete items.
5. You can toggle the dropdown from **Scan** to **Query**, enter `userId` in the partition key input (e.g., `your-email@gmail.com`), and click **Run** to filter items.

### Testing and Monitoring Functions (Lambda Console)
1. Search for **Lambda** in the top search bar.
2. Click **Functions** in the sidebar, and select your claims function (e.g., `arag-claims-tracker-ClaimsFunction-xxxxx`).
3. **Code Tab**: Scroll down to view the deployed `index.py`, `auth.py`, and `claims.py` source code in the built-in online editor.
4. **Monitor Tab**: Here you can see metrics like invocation counts, error counts, and latency graphs. Click the **View CloudWatch logs** button on the right to open the logs viewer automatically.

### Reviewing Application Logs (CloudWatch Console)
1. Search for **CloudWatch** in the top search bar.
2. In the left sidebar, expand **Logs** and click **Log groups**.
3. Search for `/aws/lambda/` and select your Lambda function's log group.
4. Click on the topmost log stream (the most recent one).
5. You will see chronological print lines showing logged events (e.g., `Received event: ...` or any errors raised).

---

## 7. Cleaning Up AWS Resources (Teardown)

To ensure you are never billed for unused learning resources, delete the infrastructure when you are done.

### Delete the Backend Stack
Run this in the root project folder:
```powershell
sam delete
```
*(Follow the prompts to confirm deletion. This will delete the API Gateway, the Lambda function, the IAM roles, and the DynamoDB Table, completely purging all data)*

### Delete the Frontend S3 Bucket
S3 buckets cannot be deleted by CloudFormation if they contain files. First, empty and delete the bucket:
```powershell
# Force empty and delete the bucket
aws s3 rb s3://your-unique-claims-tracker-frontend --force
```
