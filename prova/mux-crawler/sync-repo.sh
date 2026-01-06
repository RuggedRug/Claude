#!/bin/bash
#
# sync-repo.sh - Check for and download new commits from GitHub
#
# Usage: ./sync-repo.sh [options]
#
# Options:
#   -b, --branch BRANCH   Specify branch to sync (default: current branch or main)
#   -r, --repo URL        Repository URL (for initial clone)
#   -f, --force           Force pull even with local changes (stash first)
#   -q, --quiet           Suppress output except errors
#   -h, --help            Show this help message
#

set -e

# Configuration
DEFAULT_REPO="https://github.com/RuggedRug/Claude.git"
DEFAULT_BRANCH="claude/setup-playwright-scripts-Q9Wer"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script options
BRANCH=""
REPO_URL="$DEFAULT_REPO"
FORCE=false
QUIET=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--branch)
            BRANCH="$2"
            shift 2
            ;;
        -r|--repo)
            REPO_URL="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            head -20 "$0" | tail -15
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Logging functions
log() {
    if [ "$QUIET" = false ]; then
        echo -e "$1"
    fi
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[OK]${NC} $1"
}

log_warn() {
    log "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log_info "Working directory: $SCRIPT_DIR"

# Check if this is a git repository
if [ ! -d ".git" ]; then
    # Check parent directories for .git
    GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")

    if [ -z "$GIT_ROOT" ]; then
        log_warn "Not a git repository. Cloning from $REPO_URL..."

        # Clone into a temp directory, then move contents
        TEMP_DIR=$(mktemp -d)
        git clone --branch "$DEFAULT_BRANCH" "$REPO_URL" "$TEMP_DIR"

        # Move contents to current directory
        shopt -s dotglob
        mv "$TEMP_DIR"/* "$SCRIPT_DIR/" 2>/dev/null || true
        shopt -u dotglob
        rm -rf "$TEMP_DIR"

        log_success "Repository cloned successfully!"
        exit 0
    fi
fi

# Get current branch if not specified
if [ -z "$BRANCH" ]; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi

log_info "Branch: $BRANCH"

# Check for local changes
LOCAL_CHANGES=$(git status --porcelain)
if [ -n "$LOCAL_CHANGES" ]; then
    if [ "$FORCE" = true ]; then
        log_warn "Local changes detected. Stashing..."
        git stash push -m "sync-repo auto-stash $(date +%Y%m%d_%H%M%S)"
        STASHED=true
    else
        log_warn "Local changes detected:"
        git status --short
        log_error "Commit or stash your changes first, or use --force to auto-stash"
        exit 1
    fi
fi

# Fetch latest changes from remote
log_info "Fetching latest changes from origin..."
if ! git fetch origin "$BRANCH" 2>/dev/null; then
    # Try fetching all if specific branch fails
    git fetch origin
fi

# Get commit counts
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")

if [ -z "$REMOTE_COMMIT" ]; then
    log_error "Could not find remote branch: origin/$BRANCH"
    exit 1
fi

# Check if we're behind
BEHIND=$(git rev-list --count HEAD.."origin/$BRANCH" 2>/dev/null || echo "0")
AHEAD=$(git rev-list --count "origin/$BRANCH"..HEAD 2>/dev/null || echo "0")

log_info "Local commit:  ${LOCAL_COMMIT:0:8}"
log_info "Remote commit: ${REMOTE_COMMIT:0:8}"

if [ "$BEHIND" -eq 0 ] && [ "$AHEAD" -eq 0 ]; then
    log_success "Already up to date! No new commits."
    exit 0
fi

if [ "$AHEAD" -gt 0 ]; then
    log_warn "Local branch is $AHEAD commit(s) ahead of remote"
fi

if [ "$BEHIND" -gt 0 ]; then
    log_info "Found $BEHIND new commit(s) to download"

    # Show what commits will be pulled
    log_info "New commits:"
    git log --oneline HEAD.."origin/$BRANCH" | while read -r line; do
        log "  ${GREEN}+${NC} $line"
    done

    # Pull the changes
    log_info "Pulling changes..."
    if git pull origin "$BRANCH"; then
        log_success "Successfully downloaded $BEHIND new commit(s)!"

        # Show summary of changed files
        log_info "Changed files:"
        git diff --stat "$LOCAL_COMMIT".."$REMOTE_COMMIT" | head -20
    else
        log_error "Failed to pull changes"
        exit 1
    fi
fi

# Restore stashed changes if we stashed them
if [ "${STASHED:-false}" = true ]; then
    log_info "Restoring stashed changes..."
    if git stash pop; then
        log_success "Stashed changes restored"
    else
        log_warn "Could not auto-restore stashed changes. Use 'git stash pop' manually."
    fi
fi

log_success "Sync complete!"
