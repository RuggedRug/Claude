# MCP Local Setup Guide for Mac Mini

This guide explains how to set up an MCP (Model Context Protocol) server on your Mac Mini so that Claude Desktop can execute commands directly on your machine.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Mac Mini                       │
│                                                  │
│  ┌─────────────────┐      ┌─────────────────┐   │
│  │ Claude Desktop  │◄────►│   MCP Server    │   │
│  │                 │      │                 │   │
│  │ - Chat interface│      │ - Shell access  │   │
│  │ - MCP client    │      │ - File access   │   │
│  └─────────────────┘      └─────────────────┘   │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │            Project Files                 │    │
│  │  - Code repository                       │    │
│  │  - Webapp                                │    │
│  │  - Auto-build service                    │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Prerequisites

- Mac Mini with macOS
- Node.js installed (`brew install node`)
- Claude Desktop app installed

---

## Step 1: Install MCP Server

Open Terminal and run:

```bash
# Install the MCP shell server globally
npm install -g @anthropic-ai/mcp-server-shell

# Verify installation
npx -y @anthropic-ai/mcp-server-shell --help
```

---

## Step 2: Configure Claude Desktop

Edit the Claude Desktop configuration file:

### Open the config file:

```bash
# Create the directory if it doesn't exist
mkdir -p ~/Library/Application\ Support/Claude

# Open the config file (creates it if needed)
open -a TextEdit ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Add this configuration:

```json
{
  "mcpServers": {
    "mac-mini": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-shell"],
      "cwd": "/Users/roger/Documents/Developments2/w_mux_crawler/Github"
    }
  }
}
```

**Note:** The `cwd` sets the working directory where commands will run.

---

## Step 3: Restart Claude Desktop

1. Quit Claude Desktop completely (Cmd+Q)
2. Reopen Claude Desktop
3. The MCP server "mac-mini" should now be available

---

## Verifying the Connection

Once configured, ask Claude to test the connection:

- "Run `pwd` on my Mac Mini"
- "List files in the current directory"
- "Check git status"

Claude will have access to tools like:
- `mcp__mac-mini__shell` - Execute shell commands
- `mcp__mac-mini__read_file` - Read files
- `mcp__mac-mini__write_file` - Write files

---

## Advanced Configuration

### Multiple Working Directories

If you work on multiple projects:

```json
{
  "mcpServers": {
    "mux-crawler": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-shell"],
      "cwd": "/Users/roger/Documents/Developments2/w_mux_crawler/Github"
    },
    "other-project": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-shell"],
      "cwd": "/Users/roger/Documents/OtherProject"
    }
  }
}
```

### Add Environment Variables

```json
{
  "mcpServers": {
    "mac-mini": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-shell"],
      "cwd": "/Users/roger/Documents/Developments2/w_mux_crawler/Github",
      "env": {
        "PATH": "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin",
        "NODE_ENV": "development"
      }
    }
  }
}
```

### Restrict Allowed Commands (Security)

For a more secure setup, limit what commands can be run:

```json
{
  "mcpServers": {
    "mac-mini": {
      "command": "npx",
      "args": [
        "-y",
        "@anthropic-ai/mcp-server-shell",
        "--allowed-commands",
        "git,npm,node,cat,ls,tail,head,grep,launchctl,python3,pip"
      ],
      "cwd": "/Users/roger/Documents/Developments2/w_mux_crawler/Github"
    }
  }
}
```

---

## Troubleshooting

### Claude Desktop Doesn't Show MCP Tools

1. **Check config file is valid JSON:**
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool
   ```

2. **Verify npx works:**
   ```bash
   npx -y @anthropic-ai/mcp-server-shell --help
   ```

3. **Restart Claude Desktop completely** (Cmd+Q, then reopen)

### "Command not found" Errors

Add the full PATH to the config:

```json
{
  "mcpServers": {
    "mac-mini": {
      "command": "/opt/homebrew/bin/npx",
      "args": ["-y", "@anthropic-ai/mcp-server-shell"],
      "cwd": "/Users/roger/Documents/Developments2/w_mux_crawler/Github"
    }
  }
}
```

Find your npx path with: `which npx`

### Permission Denied

```bash
# Fix npm global permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### MCP Server Crashes

Check Claude Desktop logs:
1. Open Claude Desktop
2. Menu: Help → Show Logs
3. Look for MCP-related errors

---

## Quick Reference

| Task | Command |
|------|---------|
| Edit config | `open -a TextEdit ~/Library/Application\ Support/Claude/claude_desktop_config.json` |
| Validate JSON | `cat ~/Library/Application\ Support/Claude/claude_desktop_config.json \| python3 -m json.tool` |
| Find npx path | `which npx` |
| Reinstall MCP | `npm install -g @anthropic-ai/mcp-server-shell` |
| View Claude logs | Help → Show Logs in Claude Desktop |

---

## What Claude Can Do Once Connected

With MCP configured, Claude can:

- ✅ Run shell commands (`git pull`, `npm install`, etc.)
- ✅ Read and write files
- ✅ Check service status (`launchctl list`)
- ✅ View logs (`tail -f ~/Library/Logs/...`)
- ✅ Start/stop the webapp
- ✅ Run the auto-build script
- ✅ Debug issues directly

---

## Related Files

- `auto-build.sh` - Automatic build script
- `install-auto-build.sh` - Install auto-build service
- `sync-repo.sh` - Sync with GitHub repository
- `setup-mac.sh` - Initial Mac setup script
