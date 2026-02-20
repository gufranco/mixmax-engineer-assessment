# Feature Usage Lambdas

## Context

This project contains a setup which adds the capability to track and query usage of specific metrics for both a whole workspace and individual users.

It consists of two AWS Lambda functions, one invoked directly to query the metrics and the other consumes an sqs to update metrics. The data is stored in a dynamodb table.

### Lambda 1: `metric-query-handler`

A directly-invoked Lambda that queries usage metrics. It accepts a request with a metric name, a user or workspace identifier, and a date range (max 1825 days apart), then returns the total usage count from DynamoDB.


**Input format:**
```json
{
  "metricId": "emails-sent",
  "userId": "user-123",
  "workspaceId": "ws-456",
  "fromDate": "2024-01-15T00",
  "toDate": "2024-01-15T23"
}
```

| Field | Required | Format | Notes |
|---|---|---|---|
| `metricId` | Yes | string | The metric name to query (e.g. `"emails-sent"`) |
| `workspaceId` | Yes | string | Workspace identifier — queries `WSP#` metrics |
| `userId` | No | string | User identifier — if provided, queries `USR#` metrics instead of `WSP#` |
| `fromDate` | Yes | `YYYY-MM-DDThh` | Start of date range (hourly precision). |
| `toDate` | Yes | `YYYY-MM-DDThh` | End of date range (hourly precision). Max 1825 days from `fromDate`. |

### Lambda 2: `metric-updates-consumer`

An SQS consumer Lambda that processes usage tracking events. Each message represents a usage increment for a given metric at a specific hour.

For each record in the batch, it increments both the hourly and daily count for the corresponding workspace (and optionally user) metric in dynamodb.

**Input format (SQS event):**
```json
{
  "Records": [
    {
      "messageId": "msg-001",
      "receiptHandle": "receipt-001",
      "body": "{\"userId\":\"user-123\",\"workspaceId\":\"ws-456\",\"metricId\":\"emails-sent\",\"count\":1,\"date\":\"2024-01-15T14\"}",
      "attributes": {
        "ApproximateReceiveCount": "1",
        "SentTimestamp": "1705305600000",
        "SenderId": "SENDER",
        "ApproximateFirstReceiveTimestamp": "1705305600000"
      },
      "messageAttributes": {},
      "md5OfBody": "abc123",
      "eventSource": "aws:sqs",
      "eventSourceARN": "arn:aws:sqs:us-east-1:000000000000:feature-usage-updates",
      "awsRegion": "us-east-1"
    }
  ]
}
```

**Message body fields** (the JSON inside `body`):

| Field | Required | Format | Notes |
|---|---|---|---|
| `workspaceId` | Yes | string | Workspace identifier — always writes a `WSP#` entry |
| `userId` | No | string | User identifier — if provided, also writes a `USR#` entry |
| `metricId` | Yes | string | The metric name (e.g. `"emails-sent"`) |
| `count` | Yes | number | The increment amount |
| `date` | Yes | `YYYY-MM-DDThh` | The date and hour the usage occurred (e.g. `"2024-01-15T14"` for 2pm) |

### DynamoDB Schema

Single table design with composite key (`pk`, `sk`).

| Entity | pk | sk |
|---|---|---|
| User hourly metric | `USR#{userId}#MET#{metricId}` | `H#YYYY-MM-DDThh` |
| User daily metric | `USR#{userId}#MET#{metricId}` | `D#YYYY-MM-DD` |
| Workspace hourly metric | `WSP#{workspaceId}#MET#{metricId}` | `H#YYYY-MM-DDThh` |
| Workspace daily metric | `WSP#{workspaceId}#MET#{metricId}` | `D#YYYY-MM-DD` |

### Expected Throughput

- **`metric-query-handler`**: 500 requests/second (direct invoke)
- **SQS queue for `metric-updates-consumer`**: 300 messages/second

## How to Run

```bash
npm ci --legacy-peer-deps   # Install dependencies
npm test                    # Run unit tests
npm run test:e2e            # Run e2e tests (against DynamoDB local, started automatically)
npm run build               # Build with SAM
npm run lint                # Lint
```

## Your Task
The current project setup is basic. You need to make it release-ready, production-ready.

**Constraints:**
- The partition key and sort key format for user metrics (`USR#{userId}#MET#{metricId}`) and workspace metrics (`WSP#{workspaceId}#MET#{metricId}`) must not change
- The input format for lambdas as defined above must not change
- You must continue to use aws for infra, typescript as a language and dynamodb for the database
- We do not expect you will be deploying to AWS. We won't penalize infrastructure details that only surface at deploy time, but keep the template reasonable.
- Beyond that, you have full freedom to change anything
