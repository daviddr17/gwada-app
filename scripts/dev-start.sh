#!/usr/bin/env bash
exec bash "$(cd "$(dirname "$0")/.." && pwd)/scripts/dev-server-bg.sh" --foreground
