# Claude Code Auto-Deployment Setup Guide

This guide explains how to set up automatic deployment on your Mac Mini when Claude Code (in the cloud) makes changes to GitHub.

## Architecture Overview

```
┌─────────────────────────────────────┐          ┌─────────────────────────────┐
│            Mac Mini                  │          │           Cloud             │
│                                      │          │                             │
│  ┌─────────────┐    ┌─────────────┐ │          │  ┌─────────────────────┐    │
│  │   Claude    │    │ Auto-build  │ │  GitHub  │  │    Claude Code      │    │
│  │   Desktop   │    │   Script    │◄├──────────┼──│   (makes changes)   │    │
│  │  (Chat UI)  │    │ (polls repo)│ │   pull   │  │         │           │    │
│  └─────────────┘    └──────┬──────┘ │          │  │         ▼           │    │
│         │                  │        │          │  │  ┌─────────────┐    │    │
│         │                  ▼        │          │  │  │   GitHub    │    │    │
│         │           ┌───────────┐   │          │  │  │   (repo)    │    │    │
│         │           │  Webapp   │   │          │  │  └─────────────┘    │    │
│         │           │ (updated) │   │          │  └─────────────────────┘    │
│         │           └───────────┘   │          │                             │
│         │                           │          └─────────────────────────────┘
│         │    Internet               │
│         └───────────────────────────┼──────────────► Claude API
│                                     │
└─────────────────────────────────────┘
```

## How It Works

1. **You** chat with Claude Desktop on your Mac Mini
2. **Claude Code** (in the cloud) receives your requests
3. **Claude Code** makes changes and pushes to GitHub
4. **Auto-build script** on your Mac Mini polls GitHub every X minutes
5. When new commits are found, it **automatically pulls and deploys**

**No MCP server needed!** Claude Desktop connects directly to Claude's API.

---

## Setup Steps

### Step 1: Clone the Repository (if not done)

```bash
cd ~/Documents/Developments2/w_mux_crawler
git clone https://github.com/RuggedRug/Claude.git Github
cd Github
git checkout claude/setup-playwright-scripts-Q9Wer
```

### Step 2: Install Auto-Build Service

```bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler

# Install with your preferred settings
./install-auto-build.sh --interval 2 --restart --notify
```

Options:
| Option | Description |
|--------|-------------|
| `--interval N` | Check GitHub every N minutes (default: 5) |
| `--restart` | Auto-restart webapp after updates |
| `--notify` | Show macOS notifications |

### Step 3: Verify It's Running

```bash
# Check service status
launchctl list | grep muxcrawler

# Watch the logs
tail -f ~/Library/Logs/MuxCrawler/auto-build.log
```

---

## Workflow

### When You Want Changes:

1. Open **Claude Desktop** on your Mac Mini
2. Chat: "Add a new feature to the webapp that does X"
3. **Claude Code** (me) makes the changes and pushes to GitHub
4. Within 2 minutes (or your interval), your Mac Mini auto-pulls and deploys
5. Refresh your browser to see changes!

### Checking Status:

```bash
# See last sync time
tail -5 ~/Library/Logs/MuxCrawler/auto-build.log

# See build history
cat /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler/.build-history

# Check current commit
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github
git log -1 --format="%ci - %s"
```

### Force Immediate Sync:

```bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
./auto-build.sh
```

---

## Managing the Service

| Action | Command |
|--------|---------|
| View logs | `tail -f ~/Library/Logs/MuxCrawler/auto-build.log` |
| Check status | `launchctl list \| grep muxcrawler` |
| Stop service | `launchctl unload ~/Library/LaunchAgents/com.muxcrawler.autobuild.plist` |
| Start service | `launchctl load ~/Library/LaunchAgents/com.muxcrawler.autobuild.plist` |
| Change interval | `./install-auto-build.sh --interval 5 --restart --notify` |
| Uninstall | `./install-auto-build.sh --uninstall` |

---

## Starting the Webapp

### Development Mode:
```bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
./start-webapp.sh
```
Access at: http://localhost:5000

### Production Mode:
```bash
./start-webapp-prod.sh
```

### Stop Webapp:
```bash
./stop-webapp.sh
```

---

## Troubleshooting

### Auto-build not detecting changes

```bash
# Run manually to see what's happening
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
./auto-build.sh

# Check if service is running
launchctl list | grep muxcrawler

# Reinstall if needed
./install-auto-build.sh --interval 2 --restart --notify
```

### Webapp not starting

```bash
# Check if port is in use
lsof -i :5000

# Check Python virtual environment
source venv/bin/activate
pip install -r webapp/requirements.txt

# Try running directly
cd webapp
python app.py
```

### Changes not appearing

```bash
# Force pull latest
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github
git fetch origin claude/setup-playwright-scripts-Q9Wer
git reset --hard origin/claude/setup-playwright-scripts-Q9Wer

# Restart webapp
cd prova/mux-crawler
./stop-webapp.sh
./start-webapp.sh
```

---

## Quick Status Check

Add this alias to `~/.zshrc`:

```bash
echo 'alias mux="echo \"=== Auto-build Log ===\" && tail -3 ~/Library/Logs/MuxCrawler/auto-build.log && echo && echo \"=== Current Commit ===\" && cd /Users/roger/Documents/Developments2/w_mux_crawler/Github && git log -1 --format=\"%h %ci %s\""' >> ~/.zshrc
source ~/.zshrc
```

Then just run:
```bash
mux
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `auto-build.sh` | Checks GitHub and deploys updates |
| `install-auto-build.sh` | Installs the auto-build service |
| `sync-repo.sh` | Manual sync with GitHub |
| `start-webapp.sh` | Start Flask development server |
| `start-webapp-prod.sh` | Start with Gunicorn (production) |
| `stop-webapp.sh` | Stop the webapp |
| `setup-mac.sh` | Initial setup script |

---

## Summary

✅ **Claude Desktop** - Your chat interface (already installed)
✅ **Auto-build service** - Polls GitHub and deploys (install with `./install-auto-build.sh`)
❌ **MCP Server** - Not needed for this setup

That's it! Chat with Claude Desktop, and your changes will auto-deploy within minutes.
