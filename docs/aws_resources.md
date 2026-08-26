# AWS Resources & Infrastructure as Code (IaC)

This document provides a detailed breakdown of the AWS resources used in this application and explains how they are declared, packaged, and deployed.

---

## Infrastructure as Code: AWS SAM and CloudFormation

This project uses **AWS Serverless Application Model (SAM)** to define its serverless backend resources. 

* **What is AWS SAM?**
  AWS SAM is an open-source framework developed by AWS to simplify building and deploying serverless applications. Instead of writing verbose CloudFormation syntax, SAM offers shorthand resources (like `AWS::Serverless::Function`) designed specifically for serverless workflows.
* **Relationship to CloudFormation**:
  SAM is an extension of **AWS CloudFormation**. Under the hood, when you run `sam build` and `sam deploy`, the SAM CLI translates your `template.yaml` (using the `Transform: AWS::Serverless-2016-10-31` directive on line 2) into a standard, fully-expanded AWS CloudFormation template. This compiled template is then deployed as a **CloudFormation Stack** in your AWS account.
  
All resource creation, updates, and deletions are handled atomically. If a deployment fails, CloudFormation automatically rolls back all changes to the last stable state.

---

## Declared Backend Resources (`template.yaml`)

The `template.yaml` file defines the following resources in the `Resources` section:

### 1. DynamoDB Table (`ClaimsDatabase`)
* **Type**: `AWS::DynamoDB::Table`
* **Purpose**: Stores the JSON-structured claim logs.
* **Attributes & Keys**:
  * **`userId` (Partition Key / HASH)**: String. Isolates records by the user's email address (for multi-tenant data isolation).
  * **`id` (Sort Key / RANGE)**: String. The unique UUID of the claim.
* **Billing Mode**: `PAY_PER_REQUEST`
  * This enables **DynamoDB On-Demand**. You are billed strictly per read/write request instead of paying an hourly fee for pre-provisioned throughput. If the app is idle, the storage costs are fractions of a cent, and database compute costs are exactly **$0.00**.

### 2. HTTP API Gateway (`ClaimsApi`)
* **Type**: `AWS::Serverless::HttpApi`
* **Purpose**: Serves as the HTTPS entry point for the REST API.
* **Key Advantages**: Uses HTTP APIs (API Gateway v2) rather than REST APIs (API Gateway v1). HTTP APIs are designed for serverless integration, providing up to 70% cost reduction and lower latency.
* **CORS (Cross-Origin Resource Sharing) Configuration**:
  * Configured to accept requests from any origin (`*`) with custom headers (`Content-Type`, `Authorization`) and methods (`GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`). This allows your frontend (hosted elsewhere, such as S3 or Amplify) to safely query the backend API.

### 3. Lambda Compute Function (`ClaimsFunction`)
* **Type**: `AWS::Serverless::Function`
* **Purpose**: Runs the Python backend logic.
* **Configurations**:
  * **Runtime**: `python3.12`
  * **Memory Size**: `128 MB` (configured to keep costs minimal, as database operations and token verification are lightweight).
  * **Timeout**: `10 seconds` (plenty of time to perform token validation against Google APIs and query DynamoDB).
  * **Code Uri**: `./backend` (specifies the directory containing the Lambda files).
* **IAM Policy (`DynamoDBCrudPolicy`)**:
  * Grants the Lambda function permissions to perform Create, Read, Update, and Delete (CRUD) operations *only* on the `ClaimsDatabase` table. SAM automatically compiles this helper policy into a strict IAM Role attached to the Lambda.
* **API Event Triggers**:
  * `ListOrCreateClaims`: Listens to `ANY` HTTP request on `/claims`.
  * `ClaimActions`: Listens to `ANY` HTTP request on `/claims/{id}`.

---

## Recommended Frontend Hosting Resources

The frontend is not defined in `template.yaml` because it consists of static client-side files (`index.html`, `app.js`, `styles.css`) that do not require server compute. AWS hosting for static sites is best handled using **Amazon S3** and **Amazon CloudFront**.

To host the frontend on AWS securely, you should provision the following:

### 1. Amazon S3 Bucket (Static Storage)
* **Purpose**: Serves as the storage folder for frontend files.
* **Configuration**:
  * **Block Public Access**: **Enabled**. For security, the bucket should *not* be publicly readable.
  * **Static Website Hosting**: Disabled. S3 static hosting does not support HTTPS natively without complex setups. Instead, files should be requested through CloudFront.

### 2. Amazon CloudFront Distribution (CDN & SSL)
* **Purpose**: Distributes frontend files globally and provides SSL/HTTPS.
* **Configuration**:
  * **Origin**: Point to your S3 bucket.
  * **Origin Access Control (OAC)**: Configured to allow CloudFront to read from the private S3 bucket. CloudFront signs requests using its service principal, ensuring that users can access the files *only* via the CloudFront domain (preventing direct S3 access).
  * **Viewer Protocol Policy**: Set to `Redirect HTTP to HTTPS`.
  * **Default Root Object**: Set to `index.html`.

### 3. Route 53 & ACM (Domain & DNS - Optional)
* **Amazon Route 53**: Used to register a custom domain (e.g., `myclaims.com`) and point its DNS record to the CloudFront distribution domain (e.g., `d111111abcdef8.cloudfront.net`).
* **AWS Certificate Manager (ACM)**: Generates a free SSL/TLS certificate for your custom domain, which is then attached to CloudFront to serve the app under your branded secure URL.
