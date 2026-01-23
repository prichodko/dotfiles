#!/bin/bash
# Self-managed tools (not via Homebrew)
# Run: ./install.sh

set -e

echo "Installing deno..."
curl -fsSL https://deno.land/install.sh | sh

echo "Installing bun..."
curl -fsSL https://bun.sh/install | bash

echo "Installing claude-code..."
curl -fsSL https://claude.ai/install.sh | bash

echo "Done! Restart your shell or source your rc file."
