#!/bin/bash
set -e

FUNCTION_NAME="aws-analytica-api"
REGION="${AWS_REGION:-us-east-1}"
RUNTIME="nodejs20.x"
HANDLER="lambda.handler"
TIMEOUT=30
MEMORY=256

echo "📦 Packaging..."
npm install --production --silent
cd ..
zip -q -r function.zip backend/ -x "backend/.env*" -x "backend/deploy.sh" -x "backend/*.md"
cd backend

FUNCTION_EXISTS=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null && echo "yes" || echo "no")

if [ "$FUNCTION_EXISTS" = "yes" ]; then
  echo "🔄 Updating Lambda..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://../function.zip \
    --region "$REGION" --output text --query 'FunctionArn' > /dev/null

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --region "$REGION" --output text --query 'FunctionArn' > /dev/null
else
  echo "Enter your Lambda execution role ARN:"
  echo "(Needs: ce:GetCost*, ec2:Describe*, rds:Describe*, elasticloadbalancing:Describe*, sts:GetCallerIdentity)"
  read -r ROLE_ARN

  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --handler "$HANDLER" \
    --role "$ROLE_ARN" \
    --zip-file fileb://../function.zip \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --region "$REGION" --output text --query 'FunctionArn' > /dev/null
fi

# Set environment variables
echo "⚙️  Setting environment variables..."
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --environment "Variables={
    AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY,
    AWS_REGION=$REGION,
    FRONTEND_URL=${FRONTEND_URL:-*}
  }" \
  --region "$REGION" --output text --query 'FunctionArn' > /dev/null

# Create Function URL if needed
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region "$REGION" > /dev/null 2>&1 || true

FUNCTION_URL=$(aws lambda get-function-url-config \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('FunctionUrl',''))" 2>/dev/null)

if [ -z "$FUNCTION_URL" ]; then
  FUNCTION_URL=$(aws lambda create-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --auth-type NONE \
    --region "$REGION" | python3 -c "import sys,json; print(json.load(sys.stdin).get('FunctionUrl',''))")
fi

rm -f ../function.zip

echo ""
echo "✅ Deploy complete!"
echo ""
echo "🔗 Lambda Function URL: $FUNCTION_URL"
echo ""
echo "📋 Next steps:"
echo "   1. In Amplify Console → App settings → Environment variables:"
echo "      VITE_API_URL = ${FUNCTION_URL%/}"
echo "   2. Trigger a new Amplify build"
