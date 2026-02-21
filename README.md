# Feature Usage Lambdas

A serverless system for tracking and querying usage metrics across workspaces and individual users, built with AWS Lambda, DynamoDB, and SQS. Designed for operational visibility, data integrity at the boundary, and graceful degradation under partial failures.

## Architecture

```
                    ┌─────────────────┐
SQS Queue ────────► │  Updates        │ ──────► DynamoDB
(metric updates)    │  Handler        │         (single table)
                    └─────────────────┘
                                                    ▲
                    ┌─────────────────┐              │
Direct invoke ────► │  Query Handler  │ ─────────────┘
(metric queries)    │  Lambda         │
                    └─────────────────┘
```

The **Updates Handler** processes SQS messages containing metric updates and writes both hourly and daily counters to DynamoDB. For each message, it writes workspace-level metrics and optionally user-level metrics.

The **Query Handler** is invoked directly to query usage metrics from DynamoDB. It aggregates hourly counters across a date range and returns the total count.

Both handlers share a single DynamoDB table using a composite key design with `pk` (partition key) and `sk` (sort key). A single table keeps all access patterns co-located under one billing unit and avoids cross-table coordination.

### Why standard SQS, not FIFO

Counter increments are commutative: `ADD 5` followed by `ADD 3` produces the same result as `ADD 3` followed by `ADD 5`. Message ordering is irrelevant, so FIFO's ordering guarantee adds no value. FIFO's deduplication window is only 5 minutes, too short for real protection during DLQ replay or operational incidents. Standard SQS has nearly unlimited throughput with no configuration, while FIFO caps at 300 msg/s per message group without batching, exactly at this system's target.

### At-least-once counting

DynamoDB's `ADD` operation is commutative but not idempotent. If a partial failure causes SQS to retry a message, counters that already succeeded on the first attempt get incremented again. For aggregate usage metrics, the difference between 10,000 and 10,001 is not meaningful. Making writes atomic with `TransactWriteItems` would double the write capacity cost for a guarantee the use case doesn't need.

## Project Structure

```
src/
  config/           # Environment variable readers with safe defaults
  errors/           # ValidationError class, error formatting utility
  infrastructure/   # DynamoDB client, repository, key builders, TTL calculation
  logging/          # Pino structured logger
  schemas/          # Zod schemas, regex patterns, identifier constraints
  types/            # TypeScript interfaces derived from schemas
  validators/       # Validation functions wrapping Zod schemas
  metric-query.handler.ts      # Lambda entry point: queries
  metric-updates.handler.ts    # Lambda entry point: updates
```

Files use a `name.type.ts` naming convention: `partition-key.builder.ts`, `query-request.schema.ts`, `validation.error.ts`. The suffix tells you what a file contains before you open it.

Handlers are thin orchestrators that call validators and the repository. The repository implements `MetricRepository` interface using DynamoDB, but the handlers never import DynamoDB types or construct keys. This dependency inversion means the storage layer can be swapped or tested independently.

## Lambda 1: metric-query-handler

A directly-invoked Lambda that queries usage metrics. It accepts a request with a metric name, a user or workspace identifier, and a date range (max 1825 days apart), then returns the total usage count.

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
| `metricId` | Yes | string | The metric name to query (e.g. `"emails-sent"`). Alphanumeric, hyphens, and underscores only. Max 128 characters |
| `workspaceId` | Yes | string | Workspace identifier. Queries `WSP#` metrics. Alphanumeric, hyphens, and underscores only. Max 128 characters |
| `userId` | No | string | User identifier. If provided, queries `USR#` metrics instead of `WSP#`. Same format constraints as above |
| `fromDate` | Yes | `YYYY-MM-DDThh` | Start of date range (hourly precision) |
| `toDate` | Yes | `YYYY-MM-DDThh` | End of date range (hourly precision). Max 1825 days from `fromDate` |

Validation errors return a structured response instead of throwing:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "metricId is required and must be a non-empty string"
  }
}
```

## Lambda 2: metric-updates-handler

An SQS-triggered Lambda that processes usage tracking events. Each message represents a usage increment for a given metric at a specific hour. For each record in the batch, it increments both the hourly and daily counters for the workspace and optionally for the user.

**Input format (SQS event body):**

```json
{
  "userId": "user-123",
  "workspaceId": "ws-456",
  "metricId": "emails-sent",
  "count": 1,
  "date": "2024-01-15T14"
}
```

| Field | Required | Format | Notes |
|---|---|---|---|
| `workspaceId` | Yes | string | Workspace identifier. Always writes a `WSP#` entry. Alphanumeric, hyphens, and underscores only. Max 128 characters |
| `userId` | No | string | User identifier. If provided, also writes a `USR#` entry. Same format constraints as above |
| `metricId` | Yes | string | The metric name (e.g. `"emails-sent"`). Same format constraints as above |
| `count` | Yes | number | The increment amount. Must be a positive finite number, max 1,000,000 |
| `date` | Yes | `YYYY-MM-DDThh` | The date and hour the usage occurred |

## DynamoDB Schema

Single table design with composite key (`pk`, `sk`). Partition keys use `#` as a structural delimiter, so all identifiers are validated against `/^[a-zA-Z0-9_-]+$/` at the input boundary. Without this, a `workspaceId` containing `#` would corrupt the key structure and cause queries to return wrong results or writes to land in unrelated partitions.

| Entity | pk | sk |
|---|---|---|
| User hourly metric | `USR#{userId}#MET#{metricId}` | `H#YYYY-MM-DDThh` |
| User daily metric | `USR#{userId}#MET#{metricId}` | `D#YYYY-MM-DD` |
| Workspace hourly metric | `WSP#{workspaceId}#MET#{metricId}` | `H#YYYY-MM-DDThh` |
| Workspace daily metric | `WSP#{workspaceId}#MET#{metricId}` | `D#YYYY-MM-DD` |

Each item also contains:
- `count` (N): the accumulated metric count
- `ttl` (N): epoch seconds for automatic expiration, refreshed on every write so actively used metrics stay alive while stale data expires (90 days default, configurable per environment)

## Design Decisions

### Type safety and validation

Zod schemas are the single source of truth for both runtime validation and compile-time types. TypeScript types are derived via `z.infer<typeof schema>`, which eliminates drift between what the validator accepts and what the code expects. There is zero `any` in production code. The query handler returns validation errors as structured data (`{ error: { code, message } }`) so callers can distinguish "fix your input" from "retry later," and CloudWatch error metrics only reflect real system failures.

### Error handling

The updates handler processes each SQS record independently with its own try/catch. Within a record, all DynamoDB writes fire in parallel via `Promise.all`. If any write fails, the entire record is reported in `batchItemFailures` and only that record is retried by SQS. Records that succeed are not retried, preventing unnecessary double-counting. After 3 failed attempts, messages move to a dead letter queue. A CloudWatch alarm fires when any message arrives in the DLQ, and `scripts/replay-dlq.sh` replays messages back to the main queue after the root cause is fixed.

### Observability

Pino produces structured JSON logs with a `requestId` field (the Lambda `awsRequestId`) on every log line, making CloudWatch Logs Insights queries straightforward. AWS X-Ray is active on both handlers, so the full request path, from Lambda cold start through DynamoDB query latency, is visible in trace waterfalls without manual instrumentation. CloudWatch error alarms on both handlers are wired to an SNS topic for notifications. Log level is configurable per environment via a SAM parameter.

### Testing

Zero mocks. Unit tests validate pure functions like validation, key building, and config readers. Integration tests run handlers against real DynamoDB and SQS on LocalStack. Messages go through the actual SQS round-trip: `sendMessage`, `receiveMessage`, handler invocation, `deleteMessage`, exercising the full serialization path. All tests follow the Arrange-Act-Assert pattern with explicit comments. 84 tests total, 56 unit and 28 integration.

### Security

All identifier fields validate against a shared regex allowlist (`/^[a-zA-Z0-9_-]+$/`, max 128 characters) to prevent `#` injection into DynamoDB partition keys. The `count` field caps at 1,000,000 to prevent a single message from inflating metrics by an arbitrary amount. IAM policies follow least privilege: the query handler has `dynamodb:Query` only, the updates handler has `dynamodb:UpdateItem` only, both scoped to the specific table ARN.

## Prerequisites

| Tool | Version | Required for | Install |
|------|---------|-------------|---------|
| Node.js | 22+ | Runtime | [nodejs.org](https://nodejs.org/) or `nvm install 22` |
| pnpm | 9+ | Package manager | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker | 20+ | LocalStack, integration tests | [docker.com](https://www.docker.com/) or `brew install colima docker` |
| AWS CLI | 2+ | Interacting with LocalStack | [aws.amazon.com/cli](https://aws.amazon.com/cli/) or `brew install awscli` |
| AWS SAM CLI | 1.100+ | Building and deploying | [docs.aws.amazon.com](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) or `brew install aws-sam-cli` |

All interaction with LocalStack uses the standard AWS CLI with `--endpoint-url=http://localhost:4566`. No additional tools like `awslocal` or `samlocal` are required.

## Getting Started

```bash
pnpm install                  # Install dependencies
cp .env.example .env          # Set up environment variables
pnpm localstack:up            # Start LocalStack (port 4566)
pnpm test                     # Run unit tests (no deps needed)
pnpm test:integration         # Run integration tests (requires LocalStack)
pnpm test:all                 # Run all tests
pnpm lint                     # Lint
pnpm build                    # Build with SAM
pnpm deploy:local             # Deploy full stack to LocalStack
```

## Local Development

### LocalStack

LocalStack provides a local AWS environment on port **4566**, simulating DynamoDB, SQS, Lambda, CloudFormation, IAM, and other AWS services. The Docker socket is mounted so Lambda functions run in real containers, matching production behavior.

There are two local development paths:

| Path | Command | What it does | Best for |
|------|---------|-------------|----------|
| Quick start | `pnpm localstack:up` | Creates DynamoDB table and SQS queues via init script | Integration tests, fast iteration |
| Full simulation | `pnpm deploy:local` | Builds and deploys the full SAM stack to LocalStack | End-to-end testing, SQS-triggered Lambda execution |

```bash
# Start LocalStack (creates DynamoDB table and SQS queues automatically)
pnpm localstack:up

# Verify it is healthy
curl http://localhost:4566/_localstack/health

# View logs
pnpm localstack:logs

# Stop LocalStack
pnpm localstack:down
```

On startup, the init script at `localstack/ready.d/init.sh` automatically creates:
- DynamoDB table: `feature-usage-local` (with TTL enabled)
- SQS queue: `feature-usage-updates-local`
- SQS dead letter queue: `feature-usage-updates-dlq-local`

All commands use the standard AWS CLI pointed at LocalStack. Set these for convenience:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
```

Common operations:

```bash
# List DynamoDB tables
aws dynamodb list-tables

# Scan the metrics table
aws dynamodb scan --table-name feature-usage-local

# Check SQS queue status
aws sqs get-queue-attributes \
  --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/feature-usage-updates-local \
  --attribute-names All
```

### Full Simulation

To deploy the entire SAM stack to LocalStack, including Lambda functions with real SQS event source mappings:

```bash
pnpm localstack:up     # Start LocalStack
pnpm deploy:local      # Build + deploy full stack
```

This runs `scripts/deploy-local.sh`, which:

1. Builds the Lambda functions with `sam build`
2. Cleans up init-script resources to avoid CloudFormation conflicts
3. Deploys the full SAM template to LocalStack via `sam deploy`
4. Creates all resources: DynamoDB table, SQS queues, Lambda functions, event source mappings, SNS topic, and CloudWatch alarms

After deployment, sending a message to the SQS queue triggers the updates handler Lambda inside LocalStack, just like it would in AWS:

```bash
aws sqs send-message \
  --endpoint-url http://localhost:4566 \
  --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/feature-usage-updates-local \
  --message-body '{"userId":"user-123","workspaceId":"ws-456","metricId":"emails-sent","count":1,"date":"2024-01-15T14"}'
```

Check the result in DynamoDB:

```bash
aws dynamodb scan --endpoint-url http://localhost:4566 --table-name feature-usage-local
```

Invoke the query handler directly:

```bash
aws lambda invoke \
  --endpoint-url http://localhost:4566 \
  --function-name feature-usage-local-MetricQueryHandler \
  --payload '{"workspaceId":"ws-456","metricId":"emails-sent","fromDate":"2024-01-01T00","toDate":"2024-12-31T23"}' \
  /dev/stdout
```

### Testing

**Unit tests** test pure functions (validation, constants) and require no external dependencies:

```bash
pnpm test
```

**Integration tests** run handlers against real DynamoDB on LocalStack. Start LocalStack first:

```bash
pnpm localstack:up
pnpm test:integration
```

**All tests:**

```bash
pnpm test:all
```

## Infrastructure

The SAM template (`template.yaml`) is fully parameterized with 15 parameters, each with a sensible default. A bare `sam deploy` works out of the box. Operators can tune per environment without touching code:

```bash
sam deploy --parameter-overrides Env=production TtlDays=180 ReservedConcurrency=50
```

### Application parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `Env` | `local` | Environment name. Controls table and queue names. Allowed: `local`, `staging`, `production` |
| `TtlDays` | `90` | Days before DynamoDB items expire via TTL. Also available as `TTL_DAYS` env var |
| `MaxDateRangeDays` | `1825` | Maximum date range for metric queries. Also available as `MAX_DATE_RANGE_DAYS` env var |

### Lambda parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `LambdaTimeout` | `30` | Function timeout in seconds |
| `LambdaMemorySize` | `256` | Function memory in MB |
| `ReservedConcurrency` | `10` | Max concurrent executions for the updates handler |
| `QueryReservedConcurrency` | `10` | Max concurrent executions for the query handler |
| `LogLevel` | `info` | Minimum log level for Lambda functions. Allowed: `debug`, `info`, `warn`, `error` |

### SQS parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `SqsBatchSize` | `10` | Messages per Lambda invocation |
| `SqsVisibilityTimeout` | `60` | Visibility timeout in seconds |
| `MaxReceiveCount` | `3` | Delivery attempts before routing to DLQ |
| `DlqRetentionPeriod` | `1209600` | DLQ message retention in seconds (14 days) |

### Alarm parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ErrorAlarmThreshold` | `5` | Error count that triggers the handler error alarms |
| `ErrorAlarmPeriod` | `60` | Evaluation period in seconds |
| `ErrorAlarmEvaluationPeriods` | `3` | Consecutive periods before the alarm fires |

The DLQ depth alarm is not parameterized: it fires on any message in the DLQ, which is universally correct.

### Resources

- **DynamoDB table**: PAY_PER_REQUEST billing, TTL enabled.
- **SQS queue**: Wired to a dead letter queue via RedrivePolicy.
- **Dead letter queue**: Holds messages that failed all retry attempts.
- **CloudWatch alarms**: DLQ depth alarm, updates handler error alarm, and query handler error alarm, all wired to an SNS notification topic.
- **SNS topic**: Subscribe an email, Slack webhook, or PagerDuty endpoint to receive alarm notifications.
- **X-Ray tracing**: Active on both handlers for distributed request tracing.
- **IAM least-privilege**: Query handler has `dynamodb:Query` only. Updates handler has `dynamodb:UpdateItem` only.
- **Batch failure reporting**: `ReportBatchItemFailures` enabled so only failed records are retried, not the entire batch.

## Error Handling

The updates handler uses **partial batch failure reporting**. When processing a batch of SQS messages:

1. Each record is processed independently with its own try/catch.
2. Valid records succeed even if others in the batch fail.
3. Failed records are returned in `batchItemFailures` and only those are retried by SQS.
4. After 3 failed attempts (maxReceiveCount), messages move to the dead letter queue.
5. The DLQ depth alarm fires when any messages arrive in the DLQ.

The query handler validates all input before querying DynamoDB. Invalid requests return a structured error response with a `VALIDATION_ERROR` code and a descriptive message. System errors (DynamoDB failures, unexpected exceptions) still throw, causing Lambda to report the invocation as failed.

All log lines include a `requestId` field (the Lambda `awsRequestId`) for correlating logs from the same invocation in CloudWatch Logs Insights.

### Replaying DLQ Messages

After fixing a bug that caused messages to land in the DLQ, replay them back to the main queue:

```bash
./scripts/replay-dlq.sh
```

For non-local environments, override the queue URLs:

```bash
QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/feature-usage-updates-production \
DLQ_URL=https://sqs.us-east-1.amazonaws.com/123456789/feature-usage-updates-dlq-production \
./scripts/replay-dlq.sh
```

### Operational Runbook

#### DLQ Alert: Messages in Dead Letter Queue

`DLQDepthAlarm` fires when `ApproximateNumberOfMessagesVisible > 0`. Messages in the DLQ represent metric updates that failed 3 times and were not processed.

**1. Assess the situation:**

```bash
aws sqs get-queue-attributes \
  --queue-url <DLQ_URL> \
  --attribute-names ApproximateNumberOfMessagesVisible ApproximateNumberOfMessagesNotVisible
```

**2. Sample messages:**

```bash
aws sqs receive-message \
  --queue-url <DLQ_URL> \
  --max-number-of-messages 5 \
  --visibility-timeout 30
```

| Body looks like | Likely cause |
|----------------|-------------|
| Malformed JSON | Producer bug, message corruption |
| Valid JSON but missing fields | Schema change without backward compatibility |
| Valid JSON with expected fields | DynamoDB write failure, throttling, or transient error |

**3. Check Lambda logs:**

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/<FUNCTION_NAME> \
  --filter-pattern '"record failed"' \
  --start-time <EPOCH_MS> \
  --end-time <EPOCH_MS>
```

**4. Determine root cause:**

| Error message | Root cause | Action |
|--------------|-----------|--------|
| `malformed JSON in message` | Producer sent invalid payload | Fix the producer, discard messages |
| `workspaceId is required` or similar | Schema mismatch | Fix the producer or update validation |
| `ConditionalCheckFailedException` | DynamoDB condition failed | Investigate item state |
| `ProvisionedThroughputExceededException` | DynamoDB throttling | Switch to on-demand or increase capacity |
| `ServiceUnavailable` / timeout | Transient AWS issue | Replay the messages |

**5. Replay or discard:**

If transient, replay after the issue is resolved:

```bash
QUEUE_URL=<MAIN_QUEUE_URL> DLQ_URL=<DLQ_URL> ./scripts/replay-dlq.sh
```

If permanently invalid, purge after documenting the data loss:

```bash
aws sqs purge-queue --queue-url <DLQ_URL>
```

**6. Verify:** Confirm DLQ is empty. The alarm should return to OK within 5 minutes.

#### Lambda Error Alarm

`UpdatesHandlerErrorAlarm` or `QueryHandlerErrorAlarm` fires when error count exceeds the threshold.

**1. Check recent errors:**

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/<FUNCTION_NAME> \
  --filter-pattern '"query failed" OR "record failed" OR "batch partially failed"' \
  --start-time <EPOCH_MS>
```

**2. Check for Lambda throttling:**

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Throttles \
  --dimensions Name=FunctionName,Value=<FUNCTION_NAME> \
  --start-time <ISO_TIME> --end-time <ISO_TIME> \
  --period 60 --statistics Sum
```

If throttling is high, increase `ReservedConcurrentExecutions`.

**3. Check DynamoDB throttling:**

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=<TABLE_NAME> \
  --start-time <ISO_TIME> --end-time <ISO_TIME> \
  --period 60 --statistics Sum
```

PAY_PER_REQUEST auto-scales, but sustained traffic above 40,000 WCU may require pre-provisioned capacity.

#### Useful Commands

```bash
# List all Lambda functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `feature-usage`)].FunctionName'

# Get queue URLs
aws sqs list-queues --queue-name-prefix feature-usage

# Check Lambda concurrency
aws lambda get-function --function-name <FUNCTION_NAME> --query 'Concurrency'

# View X-Ray traces
aws xray get-trace-summaries \
  --start-time <EPOCH> --end-time <EPOCH> \
  --filter-expression 'service("<FUNCTION_NAME>")'
```

## CI/CD

GitHub Actions runs on every push and PR to `main`:

- **lint-and-typecheck**: ESLint + TypeScript compilation
- **unit-tests**: Pure function tests, no external deps
- **integration-tests**: Starts LocalStack as a service container, initializes resources, and runs handler tests against real DynamoDB

Locally, Husky pre-commit hooks run lint-staged to catch formatting and lint issues before they reach CI.

## Building and Deploying

```bash
# Build
pnpm build

# Deploy (requires AWS credentials)
sam deploy --guided --parameter-overrides Env=production
```
