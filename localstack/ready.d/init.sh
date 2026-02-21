#!/bin/bash
set -euo pipefail

# This script runs inside the LocalStack container where `awslocal` is pre-installed.
# awslocal is just a wrapper around `aws --endpoint-url=http://localhost:4566`.
# All commands are idempotent: safe to re-run without errors.

echo "Creating DynamoDB table..."
awslocal dynamodb describe-table --table-name feature-usage-local 2>/dev/null || \
awslocal dynamodb create-table \
  --table-name feature-usage-local \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

awslocal dynamodb update-time-to-live \
  --table-name feature-usage-local \
  --time-to-live-specification "Enabled=true, AttributeName=ttl" 2>/dev/null || true

echo "Creating SQS queues..."
awslocal sqs create-queue --queue-name feature-usage-updates-dlq-local 2>/dev/null || true
awslocal sqs create-queue \
  --queue-name feature-usage-updates-local \
  --attributes '{
    "VisibilityTimeout": "60",
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:feature-usage-updates-dlq-local\",\"maxReceiveCount\":\"3\"}"
  }' 2>/dev/null || true

echo "LocalStack initialization complete."
