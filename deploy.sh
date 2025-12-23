#!/bin/bash

# Cloud Run Deployment Script for DDoS Map Backend
# Usage: ./deploy.sh <project-id> <vercel-frontend-url> <otx-api-key>

set -e

if [ $# -lt 3 ]; then
    echo "Usage: $0 <project-id> <vercel-frontend-url> <otx-api-key>"
    echo "Example: $0 my-project https://myapp.vercel.app sk_live_xxxxx"
    exit 1
fi

PROJECT_ID=$1
VERCEL_URL=$2
OTX_API_KEY=$3
SERVICE_NAME="ddos-backend"
REGION="us-central1"

echo "🚀 Deploying DDoS Map Backend to Cloud Run"
echo "   Project: $PROJECT_ID"
echo "   Service: $SERVICE_NAME"
echo "   Region: $REGION"
echo "   Frontend: $VERCEL_URL"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Build image
echo "📦 Building Docker image..."
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --timeout=1800s

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --max-instances 100 \
  --min-instances 0 \
  --set-env-vars "ALLOWED_ORIGINS=$VERCEL_URL" \
  --set-env-vars "ALIENTVAULT_API_KEY=$OTX_API_KEY"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Get your backend URL:"
gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)'
echo ""
echo "2. Update Vercel with NEXT_PUBLIC_API_URL to the URL above"
