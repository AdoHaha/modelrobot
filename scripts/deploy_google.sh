#!/bin/bash
set -euo pipefail

npm ci
npm run build
npm test
gcloud app deploy app.yaml --project=mymodelrobot --account=reinadesu@gmail.com "$@"
