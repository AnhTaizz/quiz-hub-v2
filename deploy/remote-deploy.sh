#!/usr/bin/env bash
# Runs ON the production server (invoked over SSH by
# .github/workflows/deploy-production.yml). Deploys QUIZHUB_IMAGE, waits for
# health, and rolls back to the previously running image if the new one
# never becomes healthy.
#
# NOTE: this rolls back the application container image only. Flyway
# database migrations already applied by a failed deployment are NOT
# automatically reversed - see docs/deployment/CI_CD.md.
set -euo pipefail

: "${QUIZHUB_IMAGE:?QUIZHUB_IMAGE must be set}"
: "${DEPLOY_PATH:?DEPLOY_PATH must be set}"

cd "$DEPLOY_PATH"

if [ ! -f .env.production ]; then
  echo ".env.production not found in $DEPLOY_PATH" >&2
  exit 1
fi

PREVIOUS_IMAGE=""
if docker inspect quizhub-backend >/dev/null 2>&1; then
  PREVIOUS_IMAGE=$(docker inspect quizhub-backend --format '{{.Config.Image}}')
  echo "Previously running image: $PREVIOUS_IMAGE"
else
  echo "No previous quizhub-backend container found; this is a first deployment."
fi

wait_for_health() {
  local attempts=$1
  local i db_status app_status
  for i in $(seq 1 "$attempts"); do
    db_status=$(docker inspect --format='{{.State.Health.Status}}' quizhub-postgres 2>/dev/null || echo "missing")
    app_status=$(docker inspect --format='{{.State.Health.Status}}' quizhub-backend 2>/dev/null || echo "missing")
    echo "health check $i/$attempts: db=$db_status app=$app_status"
    if [ "$db_status" = "healthy" ] && [ "$app_status" = "healthy" ]; then
      return 0
    fi
    if [ "$app_status" = "unhealthy" ] || [ "$db_status" = "unhealthy" ]; then
      return 1
    fi
    sleep 5
  done
  return 1
}

echo "Pulling new image: $QUIZHUB_IMAGE"
docker pull "$QUIZHUB_IMAGE"

echo "Starting stack with new image..."
export QUIZHUB_IMAGE
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

if wait_for_health 24; then
  echo "Deployment healthy: $QUIZHUB_IMAGE"
  exit 0
fi

echo "New deployment failed to become healthy."

if [ -z "$PREVIOUS_IMAGE" ]; then
  echo "No previous image to roll back to (first deployment). Leaving the" >&2
  echo "current (unhealthy) state up for investigation." >&2
  exit 1
fi

echo "Rolling back to previous image: $PREVIOUS_IMAGE"
export QUIZHUB_IMAGE="$PREVIOUS_IMAGE"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

if wait_for_health 24; then
  echo "Rollback successful: $PREVIOUS_IMAGE is healthy again."
else
  echo "Rollback ALSO failed to become healthy. Manual intervention required." >&2
fi

echo "NOTE: this rollback only reverted the application container image." >&2
echo "Any Flyway database migrations already applied by the failed" >&2
echo "deployment are NOT automatically reversed." >&2

# Always exit non-zero here: the requested deployment failed, even if the
# rollback itself succeeded, so GitHub must show this run as failed.
exit 1
