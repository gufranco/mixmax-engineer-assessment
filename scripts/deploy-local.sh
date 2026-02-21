#!/bin/bash
set -euo pipefail

# Builds and deploys the full SAM stack to LocalStack.
# After this, Lambdas run inside LocalStack with real SQS event source mappings.
#
# Prerequisites: Docker running, LocalStack healthy (pnpm localstack:up)
# Usage:        ./scripts/deploy-local.sh
#               pnpm deploy:local

for cmd in sam aws curl; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "Error: $cmd is required but not installed." >&2
    exit 1
  fi
done

export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

STACK_NAME=feature-usage-local

echo "Checking LocalStack health..."
if ! curl -sf "$AWS_ENDPOINT_URL/_localstack/health" > /dev/null 2>&1; then
  echo "Error: LocalStack is not running. Start it with: pnpm localstack:up" >&2
  exit 1
fi

echo "Building with SAM..."
sam build

echo "Cleaning up init-script resources to avoid CloudFormation conflicts..."
aws dynamodb delete-table --table-name feature-usage-local 2>/dev/null || true
aws sqs delete-queue \
  --queue-url "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/feature-usage-updates-local" \
  2>/dev/null || true
aws sqs delete-queue \
  --queue-url "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/feature-usage-updates-dlq-local" \
  2>/dev/null || true

echo "Deploying stack '$STACK_NAME' to LocalStack..."
sam deploy \
  --stack-name "$STACK_NAME" \
  --resolve-s3 \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides "Env=local" \
  --capabilities CAPABILITY_IAM

echo ""
echo "Deployed resources:"
aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --query 'StackResources[*].[ResourceType,LogicalResourceId,PhysicalResourceId]' \
  --output table

echo ""
echo "Stack deployed successfully. SQS messages now trigger Lambda inside LocalStack."
echo ""
echo "Send a test message:"
echo "  aws sqs send-message \\"
echo "    --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/feature-usage-updates-local \\"
echo "    --message-body '{\"userId\":\"user-123\",\"workspaceId\":\"ws-456\",\"metricId\":\"emails-sent\",\"count\":1,\"date\":\"2024-01-15T14\"}'"
