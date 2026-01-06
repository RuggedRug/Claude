# MCP Remote Access Setup Guide

This guide explains how to set up an MCP (Model Context Protocol) server on your Mac Mini so that Claude Desktop can remotely execute commands on it.

## Architecture Overview

```
┌─────────────────────┐         SSH/MCP         ┌─────────────────────┐
│   Claude Desktop    │◄───────────────────────►│     Mac Mini        │
│   (Your Computer)   │                         │   (MCP Server)      │
│                     │                         │                     │
│  - Chat interface   │                         │  - Code repository  │
│  - MCP client       │                         │  - Webapp           │
│                     │                         │  - Auto-build       │
└─────────────────────┘                         └─────────────────────┘
```

## Prerequisites

- Mac Mini with macOS
- Node.js installed on Mac Mini
- SSH access enabled on Mac Mini
- Claude Desktop app on your computer

---

## Step 1: Enable SSH on Mac Mini

Open Terminal on your Mac Mini and run:

```bash
# Enable Remote Login (SSH)
sudo systemsetup -setremotelogin on

# Verify it's enabled
sudo systemsetup -getremotelogin

# Get your Mac Mini's IP address
ipconfig getifaddr en0
```

Note your IP address (e.g., `192.168.1.100`) - you'll need it later.

---

## Step 2: Install MCP Server on Mac Mini

```bash
# Install the MCP shell server globally
npm install -g @anthropic-ai/mcp-server-shell

# Or install multiple MCP servers for different capabilities
npm install -g @anthropic-ai/mcp-server-filesystem
npm install -g mcp-server-shell-command
```

---

## Step 3: Create MCP Server Script on Mac Mini

Create a startup script that configures the MCP server:

```bash
cat > ~/mcp-server.sh << 'EOF'
#!/bin/bash
# MCP Server for Claude Code remote access
# This script is called via SSH from Claude Desktop

# Set the working directory to your project
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github

# Set PATH to include common tools
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# Start MCP shell server
npx -y @anthropic-ai/mcp-server-shell
EOF

# Make it executable
chmod +x ~/mcp-server.sh
```

---

## Step 4: Set Up SSH Key Authentication (Required)

On your **desktop computer** (where Claude Desktop runs), set up passwordless SSH:

### macOS / Linux:

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "claude-desktop"

# Copy the key to your Mac Mini (replace IP address)
ssh-copy-id roger@192.168.1.100

# Test the connection (should not ask for password)
ssh roger@192.168.1.100 "echo 'SSH connection successful!'"
```

### Windows:

```powershell
# Generate SSH key
ssh-keygen -t ed25519 -C "claude-desktop"

# Copy the public key manually
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh roger@192.168.1.100 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# Test the connection
ssh roger@192.168.1.100 "echo 'SSH connection successful!'"
```

---

## Step 5: Configure Claude Desktop

Edit the Claude Desktop configuration file:

### Config File Location:

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/claude/claude_desktop_config.json` |

### Configuration:

```json
{
  "mcpServers": {
    "mac-mini": {
      "command": "ssh",
      "args": [
        "-o", "StrictHostKeyChecking=no",
        "-o", "BatchMode=yes",
        "roger@192.168.1.100",
        "~/mcp-server.sh"
      ]
    }
  }
}
```

**Important:** Replace `192.168.1.100` with your Mac Mini's actual IP address.

---

## Step 6: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. The MCP server "mac-mini" should now be available

---

## Verifying the Connection

Once configured, you can ask Claude to run commands on your Mac Mini. Claude will have access to tools like:

- `mcp__mac-mini__shell` - Execute shell commands
- `mcp__mac-mini__read_file` - Read files
- `mcp__mac-mini__write_file` - Write files

Test by asking Claude: "Run `ls -la` on my Mac Mini"

---

## Troubleshooting

### SSH Connection Fails

```bash
# Test SSH manually
ssh -v roger@192.168.1.100

# Check if SSH is enabled on Mac Mini
sudo systemsetup -getremotelogin
```

### MCP Server Not Starting

```bash
# Test the MCP script manually on Mac Mini
~/mcp-server.sh

# Check if npm/npx is in PATH
which npx
```

### Claude Desktop Doesn't Show MCP

1. Verify the config file is valid JSON (no trailing commas)
2. Check the config file location is correct
3. Restart Claude Desktop completely (not just close window)

### Permission Denied

```bash
# On Mac Mini, fix script permissions
chmod +x ~/mcp-server.sh

# Check SSH key permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

---

## Security Considerations

### Basic Security

- SSH key authentication (no passwords)
- Limit commands the MCP server can execute
- Use firewall to restrict SSH access

### Enhanced Security with Tailscale

For access across different networks or enhanced security:

```bash
# Install Tailscale on both machines
# Mac Mini:
brew install tailscale
sudo tailscaled &
tailscale up

# Your Desktop:
# Install from https://tailscale.com/download

# Use Tailscale IP in Claude config (e.g., 100.x.x.x)
```

### Restrict MCP Server Capabilities

Create a restricted MCP server script:

```bash
cat > ~/mcp-server-restricted.sh << 'EOF'
#!/bin/bash
cd /Users/roger/Documents/Developments2/w_mux_crawler/Github

# Only allow specific commands
export MCP_ALLOWED_COMMANDS="git,npm,node,cat,ls,tail,head,grep,launchctl"

npx -y @anthropic-ai/mcp-server-shell --allowed-commands "$MCP_ALLOWED_COMMANDS"
EOF

chmod +x ~/mcp-server-restricted.sh
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Check Mac Mini IP | `ipconfig getifaddr en0` |
| Enable SSH | `sudo systemsetup -setremotelogin on` |
| Test SSH | `ssh roger@IP_ADDRESS` |
| View MCP logs | Check Claude Desktop developer console |
| Restart MCP | Restart Claude Desktop |

---

## Related Files

- `auto-build.sh` - Automatic build script
- `install-auto-build.sh` - Install auto-build service
- `sync-repo.sh` - Sync with GitHub repository
- `setup-mac.sh` - Initial Mac setup script
