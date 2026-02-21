#!/bin/bash
set -euo pipefail

# Replays all messages from the dead letter queue back to the main processing queue.
# Requires: AWS CLI v2, jq
#
# Usage:
#   ./scripts/replay-dlq.sh                          # Uses local defaults
#   QUEUE_URL=... DLQ_URL=... ./scripts/replay-dlq.sh # Custom queue URLs

for cmd in aws jq; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "Error: $cmd is required but not installed." >&2
    exit 1
  fi
done

QUEUE_URL="${QUEUE_URL:-http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/feature-usage-updates-local}"
DLQ_URL="${DLQ_URL:-http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/feature-usage-updates-dlq-local}"

replayed=0

while true; do
  response=$(aws sqs receive-message --queue-url "$DLQ_URL" --max-number-of-messages 10 --wait-time-seconds 1) || {
    echo "Error: failed to receive messages from DLQ." >&2
    exit 1
  }
  messages=$(echo "$response" | jq -r '.Messages // [] | length')

  if [ "$messages" -eq 0 ]; then
    break
  fi

  for i in $(seq 0 $((messages - 1))); do
    body=$(echo "$response" | jq -r ".Messages[$i].Body")
    receipt=$(echo "$response" | jq -r ".Messages[$i].ReceiptHandle")

    if ! aws sqs send-message --queue-url "$QUEUE_URL" --message-body "$body" > /dev/null; then
      echo "Error: failed to send message back to main queue." >&2
      exit 1
    fi
    aws sqs delete-message --queue-url "$DLQ_URL" --receipt-handle "$receipt"

    replayed=$((replayed + 1))
  done
done

echo "Replayed $replayed message(s) from DLQ."
