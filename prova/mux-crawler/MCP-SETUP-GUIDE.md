# Claude Desktop + MCP + Auto-Deploy Setup Guide

This guide sets up a unified workflow where **Claude Desktop is your single interface**, with MCP for local debugging and auto-deploy for GitHub changes.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                Mac Mini                                       │
│                                                                               │
│   ┌───────────────────┐              ┌───────────────────┐                   │
│   │  Claude Desktop   │◄────MCP─────►│    MCP Server     │                   │
│   │  (Your Single UI) │              │  (shell access)   │                   │
│   └─────────┬─────────┘              └─────────┬─────────┘                   │
│             │                                  │                              │
│             │ Internet                         │ Direct access                │
│             │                                  ▼                              │
│             │                        ┌───────────────────┐                   │
│             │                        │   Project Files   │                   │
│             │                        │   • Code          │                   │
│             │                        │   • Logs          │                   │
│             │                        │   • Webapp        │                   │
│             │                        └─────────┬─────────┘                   │
│             │                                  │                              │
│             │                                  │ polls                        │
│             │                        ┌─────────┴─────────┐                   │
│             │                        │   Auto-build      │                   │
│             │                        │   Service         │                   │
│             │                        └─────────┬─────────┘                   │
│             │                                  │                              │
└─────────────┼──────────────────────────────────┼──────────────────────────────┘
              │                                  │
              ▼                                  ▼
     ┌─────────────────┐                ┌─────────────────┐
     │   Claude API    │                │     GitHub      │
     │   (cloud)       │                │   Repository    │
     └────────┬────────┘                └────────┬────────┘
              │                                  ▲
              │                                  │ push
              │         ┌─────────────────┐      │
              └────────►│  Claude Code    │──────┘
                        │  (in cloud)     │
                        └─────────────────┘
```

## How It Works

| What You Ask | Mode | What Happens |
|--------------|------|--------------|
| "Add feature X to the webapp" | **Cloud** | Claude Code writes code → pushes to GitHub → auto-build deploys |
| "Debug this error: [error]" | **MCP** | Claude reads logs/files directly via MCP → fixes in real-time |
| "Check if services are running" | **MCP** | Claude runs `launchctl` commands via MCP |
| "Show me recent commits" | **MCP** | Claude runs `git log` via MCP |
| "Restart the webapp" | **MCP** | Claude runs stop/start scripts via MCP |

**One UI (Claude Desktop), two modes (Cloud for features, MCP for debugging)!**

---

## Part 1: MCP Server Setup

This allows Claude Desktop to run commands directly on your Mac Mini.

### MCP Security: What Claude CAN and CANNOT Do

With the secure configuration below, Claude's access is restricted:

#### ✅ Claude CAN:
| Action | Example Commands |
|--------|------------------|
| Read files | `cat`, `head`, `tail`, `less` |
| List directories | `ls`, `find` |
| Check processes | `ps`, `lsof`, `launchctl list` |
| View logs | `tail -f ~/Library/Logs/...` |
| Run git commands | `git status`, `git log`, `git pull` |
| Run project scripts | `./start-webapp.sh`, `./auto-build.sh` |
| Run npm/node/python | `npm install`, `python app.py` |
| Search files | `grep`, `find` |

#### ❌ Claude CANNOT:
| Action | Blocked Commands |
|--------|------------------|
| Delete files/folders | `rm`, `rm -rf`, `rmdir` |
| System administration | `sudo`, `su` |
| Change permissions | `chmod`, `chown` |
| Download from internet | `curl`, `wget` |
| Modify system files | Any file outside allowed directories |
| Kill arbitrary processes | `kill`, `killall` (except own processes) |
| Access other directories | Only allowed in project + logs folders |

### Step 1: Install MCP Shell Server

```bash
# Install globally
npm install -g @mako10k/mcp-shell-server

# Verify installation
npx -y @mako10k/mcp-shell-server --help
```

> **Note:** We use [@mako10k/mcp-shell-server](https://www.npmjs.com/package/@mako10k/mcp-shell-server),
> a secure MCP server for shell operations and terminal management.

### Step 2: Configure Claude Desktop (Secure Mode)

Create or update the Claude Desktop configuration file:

```bash
# Create config directory if needed
mkdir -p ~/Library/Application\ Support/Claude

# Create the configuration file with SECURITY RESTRICTIONS
cat > ~/Library/Application\ Support/Claude/claude_desktop_config.json << 'EOF'
{
  "mcpServers": {
    "mac-mini": {
      "command": "npx",
      "args": ["-y", "@mako10k/mcp-shell-server"],
      "cwd": "/Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler",
      "env": {
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        "MCP_SHELL_SECURITY_MODE": "restrictive",
        "MCP_SHELL_ALLOWED_WORKDIRS": "/Users/roger/Documents/Developments2/w_mux_crawler,/Users/roger/Library/Logs/MuxCrawler",
        "MCP_SHELL_MAX_EXECUTION_TIME": "300",
        "MCP_SHELL_MAX_MEMORY_MB": "1024",
        "MCP_DISABLED_TOOLS": "process_terminate"
      }
    }
  }
}
EOF
```

### Security Configuration Explained

| Setting | Value | Purpose |
|---------|-------|---------|
| `MCP_SHELL_SECURITY_MODE` | `restrictive` | Use strict command allowlist |
| `MCP_SHELL_ALLOWED_WORKDIRS` | Project + Logs paths | Limit file access to these folders only |
| `MCP_SHELL_MAX_EXECUTION_TIME` | `300` | Commands timeout after 5 minutes |
| `MCP_SHELL_MAX_MEMORY_MB` | `1024` | Limit memory usage to 1GB |
| `MCP_DISABLED_TOOLS` | `process_terminate` | Prevent killing processes |

### Security Modes Available

| Mode | Description | Recommended For |
|------|-------------|-----------------|
| `restrictive` | Strict allowlist, limited commands | **Production (recommended)** |
| `enhanced` | LLM-based safety evaluation | Balanced security |
| `enhanced-fast` | Faster LLM checks | Performance-focused |
| `permissive` | Minimal restrictions | Development only |
| `custom` | Define your own rules | Advanced users |

### Step 3: Restart Claude Desktop

1. **Quit** Claude Desktop completely (Cmd+Q, not just close window)
2. **Reopen** Claude Desktop
3. The MCP server should now be available

### Step 4: Verify MCP Connection

In Claude Desktop, ask:
> "Use MCP to run `pwd` and show me the current directory"

If working, Claude will execute the command and show the result.

### MCP Troubleshooting

If MCP isn't working:

```bash
# Check config file is valid JSON
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool

# Test MCP server manually with security settings
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
MCP_SHELL_SECURITY_MODE=restrictive npx -y @mako10k/mcp-shell-server

# Find npx path if needed
which npx
# Use full path in config: "/opt/homebrew/bin/npx"
```

### If Security is Too Restrictive

If Claude cannot run a command you expected, you can temporarily switch to `enhanced` mode:

```json
"MCP_SHELL_SECURITY_MODE": "enhanced"
```

Or add specific directories to the allowed list:

```json
"MCP_SHELL_ALLOWED_WORKDIRS": "/Users/roger/Documents/Developments2/w_mux_crawler,/Users/roger/Library/Logs/MuxCrawler,/additional/path"
```

---

## Part 2: Auto-Deploy Setup

This automatically pulls and deploys changes when Claude Code pushes to GitHub.

### Step 1: Verify Repository

```bash
# Check repository exists
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

# Install with 2-minute interval, auto-restart webapp, and notifications
./install-auto-build.sh --interval 2 --restart --notify
```

### Step 3: Verify Auto-Build is Running

```bash
# Check service status
launchctl list | grep muxcrawler

# Watch logs
tail -f ~/Library/Logs/MuxCrawler/auto-build.log
```

### Auto-Build Options

| Option | Description |
|--------|-------------|
| `--interval N` | Check GitHub every N minutes (default: 5) |
| `--restart` | Auto-restart webapp after updates |
| `--notify` | Show macOS notifications |
| `--uninstall` | Remove the service |

---

## Part 3: Webapp Setup

### Install Dependencies (One Time)

```bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler

# Create/activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r webapp/requirements.txt
```

### Start Webapp

```bash
# Development mode (auto-reload on changes)
./start-webapp.sh

# Production mode (Gunicorn)
./start-webapp-prod.sh
```

Access at: **http://localhost:5000**

### Stop Webapp

```bash
./stop-webapp.sh
```

---

## Part 4: Shell Aliases (Optional)

Add convenient shortcuts to your shell:

```bash
cat >> ~/.zshrc << 'EOF'

# === Mux Crawler Shortcuts ===
export MUX_DIR="/Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler"

# Status check
alias mux-status='echo "=== Auto-build Log ===" && tail -5 ~/Library/Logs/MuxCrawler/auto-build.log && echo && echo "=== Current Commit ===" && cd /Users/roger/Documents/Developments2/w_mux_crawler/Github && git log -1 --format="%h %s (%cr)"'

# Log watching
alias mux-logs='tail -f ~/Library/Logs/MuxCrawler/auto-build.log'

# Force sync
alias mux-sync='cd $MUX_DIR && ./auto-build.sh'

# Webapp control
alias mux-start='cd $MUX_DIR && ./start-webapp.sh'
alias mux-stop='cd $MUX_DIR && ./stop-webapp.sh'
alias mux-restart='cd $MUX_DIR && ./stop-webapp.sh; ./start-webapp.sh'

# Quick directory access
alias mux-cd='cd $MUX_DIR'
EOF

source ~/.zshrc
```

Now you can use:

| Command | Action |
|---------|--------|
| `mux-status` | Show sync status and current commit |
| `mux-logs` | Watch auto-build logs live |
| `mux-sync` | Force sync with GitHub |
| `mux-start` | Start the webapp |
| `mux-stop` | Stop the webapp |
| `mux-restart` | Restart the webapp |
| `mux-cd` | Go to project directory |

---

## Workflow Examples

### Example 1: Request a New Feature

**You (in Claude Desktop):** "Add a dark mode toggle to the settings page"

**What happens:**
1. Claude Code (cloud) writes the code
2. Claude Code pushes to GitHub
3. Auto-build detects the change (within 2 min)
4. Auto-build pulls and restarts webapp
5. You get a macOS notification
6. Refresh browser to see the feature!

---

### Example 2: Debug an Error

**You (in Claude Desktop):** "The webapp shows an error when I click Export. Can you check the logs?"

**What happens:**
1. Claude uses MCP to run: `tail -50 webapp/logs/error.log`
2. Claude sees the error and identifies the issue
3. Claude uses MCP to check the relevant code file
4. Claude explains the problem and offers to fix it
5. If you approve, Claude Code pushes fix → auto-deploys

---

### Example 3: Check System Status

**You (in Claude Desktop):** "Is everything running properly?"

**What happens:**
1. Claude uses MCP to check auto-build: `launchctl list | grep muxcrawler`
2. Claude uses MCP to check webapp: `lsof -i :5000`
3. Claude uses MCP to show recent logs: `tail -10 ~/Library/Logs/MuxCrawler/auto-build.log`
4. Claude reports status of all services

---

### Example 4: Manual Operations

**You (in Claude Desktop):** "Restart the webapp"

**What happens:**
1. Claude uses MCP to run: `./stop-webapp.sh`
2. Claude uses MCP to run: `./start-webapp.sh`
3. Claude confirms webapp is running

---

## Troubleshooting

### MCP Not Working

```bash
# 1. Check config file syntax
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool

# 2. Test MCP server manually with security mode
MCP_SHELL_SECURITY_MODE=restrictive npx -y @mako10k/mcp-shell-server

# 3. Check Claude Desktop logs
# Menu: Help → Show Logs

# 4. Try with full npx path
which npx  # e.g., /opt/homebrew/bin/npx
# Update config to use full path

# 5. If commands are blocked, check security mode
# Try switching from "restrictive" to "enhanced" temporarily
```

### Auto-Build Not Working

```bash
# 1. Check service status
launchctl list | grep muxcrawler

# 2. Run manually to see errors
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
./auto-build.sh

# 3. Check logs for errors
cat ~/Library/Logs/MuxCrawler/stderr.log

# 4. Reinstall service
./install-auto-build.sh --interval 2 --restart --notify
```

### Webapp Not Starting

```bash
# 1. Check if port is in use
lsof -i :5000

# 2. Check Python environment
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github/prova/mux-crawler
source venv/bin/activate
pip install -r webapp/requirements.txt

# 3. Run directly to see errors
cd webapp
python app.py

# 4. Check .env file exists and has correct DATABASE_URL
cat ../.env
```

### Changes Not Appearing

```bash
# 1. Force pull from GitHub
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github
git fetch origin claude/setup-playwright-scripts-Q9Wer
git reset --hard origin/claude/setup-playwright-scripts-Q9Wer

# 2. Restart webapp
cd prova/mux-crawler
./stop-webapp.sh
./start-webapp.sh
```

---

## Setup Checklist

### One-Time Setup

- [ ] **Repository cloned** to `/Users/roger/Documents/Developments2/w_mux_crawler/Github`
- [ ] **MCP server installed**: `npm install -g @mako10k/mcp-shell-server`
- [ ] **Claude Desktop configured**: config file at `~/Library/Application Support/Claude/claude_desktop_config.json`
- [ ] **Claude Desktop restarted** after config change
- [ ] **MCP verified**: Ask Claude to run a command via MCP
- [ ] **Auto-build installed**: `./install-auto-build.sh --interval 2 --restart --notify`
- [ ] **Auto-build verified**: `launchctl list | grep muxcrawler`
- [ ] **Python venv created**: `python3 -m venv venv`
- [ ] **Dependencies installed**: `pip install -r webapp/requirements.txt`
- [ ] **Shell aliases added** (optional): Added to `~/.zshrc`

### Verify Everything Works

1. **MCP Test**: Ask Claude "Run `pwd` via MCP"
2. **Auto-build Test**: Check `tail ~/Library/Logs/MuxCrawler/auto-build.log`
3. **Webapp Test**: Run `./start-webapp.sh` and visit http://localhost:5000

---

## Quick Reference

### Commands via MCP (Ask Claude)

| Request | Claude Uses |
|---------|-------------|
| "Show recent logs" | `tail -20 ~/Library/Logs/MuxCrawler/auto-build.log` |
| "Is webapp running?" | `lsof -i :5000` |
| "Check git status" | `git status` |
| "Show last commit" | `git log -1` |
| "Restart webapp" | `./stop-webapp.sh && ./start-webapp.sh` |
| "Force sync now" | `./auto-build.sh` |

### Service Management

| Action | Command |
|--------|---------|
| View auto-build logs | `tail -f ~/Library/Logs/MuxCrawler/auto-build.log` |
| Check auto-build status | `launchctl list \| grep muxcrawler` |
| Stop auto-build | `launchctl unload ~/Library/LaunchAgents/com.muxcrawler.autobuild.plist` |
| Start auto-build | `launchctl load ~/Library/LaunchAgents/com.muxcrawler.autobuild.plist` |
| Uninstall auto-build | `./install-auto-build.sh --uninstall` |

### File Locations

| File | Purpose |
|------|---------|
| `~/Library/Application Support/Claude/claude_desktop_config.json` | Claude Desktop MCP config |
| `~/Library/LaunchAgents/com.muxcrawler.autobuild.plist` | Auto-build service config |
| `~/Library/Logs/MuxCrawler/auto-build.log` | Auto-build logs |
| `/Users/roger/Documents/Developments2/w_mux_crawler/Github/` | Git repository |
| `.../prova/mux-crawler/` | Project root |
| `.../prova/mux-crawler/webapp/` | Flask webapp |
| `.../prova/mux-crawler/.env` | Environment variables |

---

## Summary

**Your Setup:**
- ✅ **Claude Desktop** = Single UI for everything
- ✅ **MCP Server** = Gives Claude direct access for debugging (with security restrictions)
- ✅ **Auto-build** = Deploys GitHub changes automatically
- ✅ **Flask Webapp** = Your application at localhost:5000

**Security Summary:**
- 🔒 **Mode**: Restrictive (strict command allowlist)
- 🔒 **Directories**: Limited to project folder + logs only
- 🔒 **Blocked**: `rm`, `sudo`, `chmod`, `curl`, `wget`, `kill`
- 🔒 **Timeout**: Commands limited to 5 minutes
- 🔒 **Memory**: Limited to 1GB per command

**Your Workflow:**
1. Chat with Claude Desktop
2. Request features → auto-deployed via GitHub
3. Debug issues → handled via MCP (with security limits)
4. Everything in one place, securely!
