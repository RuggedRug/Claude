# Hybrid Claude Setup Guide

This guide sets up the best of both worlds: **auto-deployment from GitHub** for regular changes, plus **Claude Code CLI** for direct debugging when needed.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Mac Mini                                        │
│                                                                              │
│   ┌─────────────────┐         ┌─────────────────┐         ┌──────────────┐  │
│   │ Claude Desktop  │         │ Claude Code CLI │         │ Auto-build   │  │
│   │ (casual chat)   │         │ (debugging)     │         │ Service      │  │
│   └────────┬────────┘         └────────┬────────┘         └───────┬──────┘  │
│            │                           │                          │         │
│            │ Internet                  │ Direct                   │ Polls   │
│            ▼                           ▼                          ▼         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         Project Files                                │   │
│   │   /Users/roger/Documents/Developments2/w_mux_crawler/Github          │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
   │  Claude API     │      │     GitHub      │      │  Flask Webapp   │
   │  (cloud)        │      │  (repository)   │      │  (localhost)    │
   └─────────────────┘      └─────────────────┘      └─────────────────┘
```

## When to Use What

| Scenario | Tool | Why |
|----------|------|-----|
| Request new features | Claude Desktop | Changes go through GitHub, auto-deployed |
| Quick questions | Claude Desktop | No code changes needed |
| Debugging errors | Claude Code CLI | I can see logs and run commands directly |
| Fixing failed builds | Claude Code CLI | I can diagnose and fix immediately |
| Reviewing code | Either | Depends on complexity |

---

## Part 1: Auto-Deploy Setup (GitHub Polling)

This handles automatic deployment when I push changes to GitHub.

### Step 1: Ensure Repository is Cloned

```bash
# Check if already cloned
ls /Users/roger/Documents/Developments2/w_mux_crawler/Github

# If not, clone it
cd ~/Documents/Developments2/w_mux_crawler
git clone https://github.com/RuggedRug/Claude.git Github
cd Github
git checkout claude/setup-playwright-scripts-Q9Wer
```

### Step 2: Install Auto-Build Service

```bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler

# Install with notifications and auto-restart
./install-auto-build.sh --interval 2 --restart --notify
```

### Step 3: Verify It's Running

```bash
# Check service status
launchctl list | grep muxcrawler

# Should show something like:
# -    0    com.muxcrawler.autobuild

# Watch the logs
tail -f ~/Library/Logs/MuxCrawler/auto-build.log
```

### Auto-Build Commands Reference

| Action | Command |
|--------|---------|
| View logs | `tail -f ~/Library/Logs/MuxCrawler/auto-build.log` |
| Check status | `launchctl list \| grep muxcrawler` |
| Force sync now | `./auto-build.sh` |
| Change interval | `./install-auto-build.sh --interval 5 --restart --notify` |
| Stop service | `launchctl unload ~/Library/LaunchAgents/com.muxcrawler.autobuild.plist` |
| Start service | `launchctl load ~/Library/LaunchAgents/com.muxcrawler.autobuild.plist` |
| Uninstall | `./install-auto-build.sh --uninstall` |

---

## Part 2: Claude Code CLI Setup (Direct Debugging)

This allows me to run commands directly on your Mac Mini when debugging.

### Step 1: Install Node.js (if not installed)

```bash
# Check if Node.js is installed
node --version

# If not installed, install via Homebrew
brew install node
```

### Step 2: Install Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

### Step 3: Authenticate Claude Code

```bash
# Run claude and follow the authentication prompts
claude
```

This will open a browser to authenticate with your Anthropic account.

### Step 4: Create a Launch Script

For convenience, create a script to start Claude Code in the project directory:

```bash
cat > /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler/start-claude.sh << 'EOF'
#!/bin/bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
claude
EOF

chmod +x /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler/start-claude.sh
```

### Step 5: Using Claude Code CLI

```bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler

# Start Claude Code
claude

# Or use the shortcut
./start-claude.sh
```

Now you're in a terminal chat with me, and I can:
- Read/write files directly
- Run shell commands
- See error logs
- Debug issues in real-time

---

## Part 3: Webapp Setup

### Start the Webapp

```bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler

# Development mode (with auto-reload)
./start-webapp.sh

# Production mode (with Gunicorn)
./start-webapp-prod.sh
```

Access at: **http://localhost:5000**

### Stop the Webapp

```bash
./stop-webapp.sh
```

### Webapp Logs

```bash
# If running in foreground, logs appear in terminal
# If running in background:
tail -f webapp.log
```

---

## Workflow Examples

### Example 1: Requesting a New Feature

1. Open **Claude Desktop** on your Mac Mini
2. Chat: *"Add a dark mode toggle to the webapp"*
3. I make changes and push to GitHub
4. Within 2 minutes, auto-build pulls and deploys
5. You get a macOS notification
6. Refresh browser to see changes

### Example 2: Debugging an Error

1. You see an error in the webapp
2. Open **Terminal** and start Claude Code CLI:
   ```bash
   cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
   claude
   ```
3. Tell me: *"The webapp crashes when I click export. Here's the error: [paste error]"*
4. I can:
   - Read the log files directly
   - Check the code
   - Run test commands
   - Fix and test immediately
5. Once fixed, I commit to GitHub (changes sync everywhere)

### Example 3: Checking System Status

Using Claude Desktop or Claude Code CLI:
- *"Is the auto-build service running?"*
- *"Show me recent deployment logs"*
- *"What's the current git commit?"*

With Claude Code CLI, I can answer these by running commands directly.

---

## Quick Status Commands

Add these aliases to your `~/.zshrc`:

```bash
cat >> ~/.zshrc << 'EOF'

# Mux Crawler shortcuts
alias mux-status='echo "=== Auto-build ===" && tail -3 ~/Library/Logs/MuxCrawler/auto-build.log && echo && echo "=== Git Status ===" && cd /Users/roger/Documents/Developments2/w_mux_crawler/Github && git log -1 --format="%h %ci %s"'
alias mux-logs='tail -f ~/Library/Logs/MuxCrawler/auto-build.log'
alias mux-sync='cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler && ./auto-build.sh'
alias mux-claude='cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler && claude'
alias mux-webapp='cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler && ./start-webapp.sh'
EOF

source ~/.zshrc
```

Now you can use:
| Command | Action |
|---------|--------|
| `mux-status` | Show last sync and current commit |
| `mux-logs` | Watch auto-build logs live |
| `mux-sync` | Force sync with GitHub now |
| `mux-claude` | Start Claude Code CLI in project |
| `mux-webapp` | Start the webapp |

---

## Troubleshooting

### Auto-build not working

```bash
# Check if service is running
launchctl list | grep muxcrawler

# Run manually to see errors
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
./auto-build.sh

# Reinstall service
./install-auto-build.sh --interval 2 --restart --notify
```

### Claude Code CLI not found

```bash
# Reinstall
npm install -g @anthropic-ai/claude-code

# Check npm global path
npm config get prefix
# Add to PATH if needed:
export PATH="$(npm config get prefix)/bin:$PATH"
```

### Webapp won't start

```bash
# Check Python environment
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
source venv/bin/activate
pip install -r webapp/requirements.txt

# Check for port conflict
lsof -i :5000

# Run directly to see errors
cd webapp
python app.py
```

### Git conflicts after auto-build

```bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github

# Reset to remote version
git fetch origin claude/setup-playwright-scripts-Q9Wer
git reset --hard origin/claude/setup-playwright-scripts-Q9Wer
```

---

## Summary Checklist

### Initial Setup (One Time)

- [ ] Repository cloned to `/Users/roger/Documents/Developments2/w_mux_crawler/Github`
- [ ] Auto-build service installed (`./install-auto-build.sh --interval 2 --restart --notify`)
- [ ] Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- [ ] Claude Code authenticated (`claude` → follow prompts)
- [ ] Shell aliases added to `~/.zshrc`
- [ ] Python venv set up (`source venv/bin/activate && pip install -r webapp/requirements.txt`)

### Daily Use

| Task | How |
|------|-----|
| Request features | Claude Desktop |
| Debug issues | Claude Code CLI (`mux-claude`) |
| Check status | `mux-status` |
| View logs | `mux-logs` |
| Force sync | `mux-sync` |
| Start webapp | `mux-webapp` |

---

## Files Reference

| File | Purpose |
|------|---------|
| `auto-build.sh` | Polls GitHub and deploys updates |
| `install-auto-build.sh` | Installs/manages auto-build service |
| `sync-repo.sh` | Manual sync with GitHub |
| `start-webapp.sh` | Start Flask dev server |
| `start-webapp-prod.sh` | Start with Gunicorn |
| `stop-webapp.sh` | Stop the webapp |
| `start-claude.sh` | Start Claude Code CLI (create with setup above) |
| `setup-mac.sh` | Initial Mac setup |
