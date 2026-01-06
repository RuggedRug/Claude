# Installation Guide for Mac

## Quick Install (One-Liner)

Run this command in your Mac terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/RuggedRug/Claude/claude/setup-playwright-scripts-Q9Wer/prova/mux-crawler/setup-mac.sh | bash
```

Or if you prefer to review the script first:

```bash
# Download the script
curl -O https://raw.githubusercontent.com/RuggedRug/Claude/claude/setup-playwright-scripts-Q9Wer/prova/mux-crawler/setup-mac.sh

# Review it
cat setup-mac.sh

# Make it executable and run
chmod +x setup-mac.sh
./setup-mac.sh
```

## Manual Installation

### Step 1: Install Prerequisites

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js and PostgreSQL
brew install node@20 postgresql@16

# Start PostgreSQL
brew services start postgresql@16
```

### Step 2: Clone the Repository

```bash
# Clone to your home directory
git clone --branch claude/setup-playwright-scripts-Q9Wer \
  https://github.com/RuggedRug/Claude.git \
  ~/mux-crawler

# Navigate to the project
cd ~/mux-crawler/prova/mux-crawler
```

### Step 3: Install Dependencies

```bash
# Install npm packages
npm install

# Install Playwright browser
npx playwright install chromium
```

### Step 4: Set Up Database

```bash
# Create the database
createdb mux_analytics

# Apply the schema
psql -d mux_analytics -f schema.sql
```

### Step 5: Configure Environment

```bash
# Copy the example config
cp .env.example .env

# Edit with your settings
nano .env
```

Update these values in `.env`:
- `DATABASE_URL` - Your PostgreSQL connection string
- `MUX_ORG_ID` - Your Mux organization ID
- `MUX_ENV_ID` - Your Mux environment ID

### Step 6: Authenticate

First run requires manual login to Mux:

```bash
npm run test:headed
```

This will:
1. Open a browser window
2. Navigate to Mux login
3. Wait for you to log in and complete MFA
4. Save the session to `auth/auth.json`

### Step 7: Run Extraction

```bash
# Run in headless mode
npm run extract

# Or with visible browser (for debugging)
npm run test:headed
```

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
brew services list

# Start PostgreSQL
brew services start postgresql@16

# Check connection
psql -d mux_analytics -c "SELECT 1"
```

### Session Expired

Delete the auth file and re-authenticate:

```bash
rm auth/auth.json
npm run test:headed
```

### Reset Extraction Progress

```bash
psql -d mux_analytics -c "DELETE FROM backfill_checkpoint;"
psql -d mux_analytics -c "DELETE FROM view_ingestion_status;"
```

### View Extraction Status

```bash
psql -d mux_analytics -c "
  SELECT status, COUNT(*)
  FROM view_ingestion_status
  GROUP BY status;
"
```

## Running as a Scheduled Job (Optional)

To run the extraction automatically, add a cron job:

```bash
# Edit crontab
crontab -e

# Add this line to run every 6 hours
0 */6 * * * cd ~/mux-crawler/prova/mux-crawler && npm run extract >> ~/mux-crawler.log 2>&1
```

## Project Structure

```
~/mux-crawler/prova/mux-crawler/
├── auth/
│   ├── global-setup.ts    # Authentication setup
│   └── auth.json          # Saved session (created after login)
├── scripts/               # Metric extractors
├── tests/
│   └── extraction.spec.ts # Main extraction test
├── utils/
│   ├── db.ts              # Database functions
│   └── viewHelper.ts      # View extraction helpers
├── .env                   # Your configuration (create from .env.example)
├── .env.example           # Example configuration
├── schema.sql             # Database schema
├── package.json
└── playwright.config.ts
```
