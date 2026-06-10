#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm install
npm run install:resources
npm run dev
