#!/bin/bash

#===============================================================================
# Mux Dashboard Crawler - Mac Setup Script (with Flask Web UI)
#===============================================================================
# This script will:
# 1. Check/install prerequisites (Node.js, PostgreSQL, Python)
# 2. Clone the repository from GitHub
# 3. Install Node.js and Python dependencies
# 4. Set up the PostgreSQL database
# 5. Configure environment variables
# 6. Set up the Flask web application
# 7. Create helper scripts
#===============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - UPDATE THESE VALUES
GITHUB_REPO="RuggedRug/Claude"
BRANCH="claude/setup-playwright-scripts-Q9Wer"
INSTALL_DIR="$HOME/mux-crawler"

# Database configuration
DB_NAME="mux_analytics"
DB_USER="postgres"
DB_PASSWORD="your_password_here"  # CHANGE THIS!
DB_HOST="localhost"
DB_PORT="5432"

# Mux configuration - UPDATE THESE VALUES
MUX_ORG_ID="g4m6v6"
MUX_ENV_ID="4l0u8v"
MUX_USER_ID=""  # Optional: filter by user ID

# Flask configuration
FLASK_PORT=5000

#===============================================================================
# Helper Functions
#===============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_warning "$1 is not installed"
        return 1
    fi
}

#===============================================================================
# Prerequisites Check
#===============================================================================

print_header "Checking Prerequisites"

# Check for Homebrew
if ! check_command brew; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ $(uname -m) == "arm64" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
fi

# Check for Git
if ! check_command git; then
    echo "Installing Git..."
    brew install git
fi

# Check for Node.js
if ! check_command node; then
    echo "Installing Node.js..."
    brew install node@20
    brew link node@20
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_warning "Node.js version is too old (requires 18+)"
        echo "Upgrading Node.js..."
        brew upgrade node || brew install node@20
    fi
fi

# Check for Python
if ! check_command python3; then
    echo "Installing Python..."
    brew install python@3.11
else
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
    print_success "Python $PYTHON_VERSION installed"
fi

# Check for PostgreSQL
if ! check_command psql; then
    echo "Installing PostgreSQL..."
    brew install postgresql@16
    brew services start postgresql@16

    # Add PostgreSQL to PATH
    echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
    export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

    # Wait for PostgreSQL to start
    sleep 3
else
    # Make sure PostgreSQL is running
    if ! brew services list | grep -q "postgresql.*started"; then
        echo "Starting PostgreSQL..."
        brew services start postgresql@16 || brew services start postgresql
    fi
fi

print_success "All prerequisites installed"

#===============================================================================
# Clone Repository
#===============================================================================

print_header "Cloning Repository"

# Remove existing directory if it exists
if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    read -p "Do you want to remove it and start fresh? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        print_error "Aborting installation"
        exit 1
    fi
fi

# Clone the repository
echo "Cloning from GitHub..."
git clone --branch "$BRANCH" --single-branch "https://github.com/$GITHUB_REPO.git" "$INSTALL_DIR"

# Navigate to the mux-crawler directory
cd "$INSTALL_DIR/prova/mux-crawler"

print_success "Repository cloned to $INSTALL_DIR"

#===============================================================================
# Install Node.js Dependencies
#===============================================================================

print_header "Installing Node.js Dependencies"

npm install

# Install Playwright browsers
echo "Installing Playwright browsers (this may take a few minutes)..."
npx playwright install chromium

print_success "Node.js dependencies installed"

#===============================================================================
# Install Python Dependencies
#===============================================================================

print_header "Installing Python Dependencies"

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Flask app dependencies
pip install -r webapp/requirements.txt

print_success "Python dependencies installed"

#===============================================================================
# Database Setup
#===============================================================================

print_header "Setting Up Database"

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    print_warning "Database '$DB_NAME' already exists"
    read -p "Do you want to drop and recreate it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        dropdb "$DB_NAME" 2>/dev/null || true
        createdb "$DB_NAME"
        print_success "Database recreated"
    fi
else
    createdb "$DB_NAME"
    print_success "Database '$DB_NAME' created"
fi

# Apply schema
echo "Applying database schema..."
psql -d "$DB_NAME" -f schema.sql

print_success "Database schema applied"

#===============================================================================
# Environment Configuration
#===============================================================================

print_header "Configuring Environment"

# Create .env file
cat > .env << EOF
# Mux Dashboard Crawler Configuration
# Generated on $(date)

# Flask Configuration
FLASK_ENV=development
SECRET_KEY=$(openssl rand -hex 32)

# Manual Verification Timeout (5 minutes in milliseconds)
MANUAL_VERIFICATION_WAIT=300000

# PostgreSQL Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# PostgreSQL connection string
DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME

# Mux Dashboard Configuration
MUX_ORG_ID=$MUX_ORG_ID
MUX_ENV_ID=$MUX_ENV_ID
MUX_USER_ID=$MUX_USER_ID

# Extraction Configuration
EXTRACTION_START_DATE=2024-10-01
CONCURRENCY_LIMIT=3
EOF

print_success "Environment file created"

# Remind user to update credentials
print_warning "IMPORTANT: Edit .env file to update your database password!"
echo "  File location: $INSTALL_DIR/prova/mux-crawler/.env"

#===============================================================================
# Create Helper Scripts
#===============================================================================

print_header "Creating Helper Scripts"

# Create start-webapp script
cat > start-webapp.sh << 'EOF'
#!/bin/bash
# Start the Mux Crawler Web Application

cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Load environment variables
set -a
source .env
set +a

echo ""
echo "=========================================="
echo "  Mux Dashboard Crawler - Web UI"
echo "=========================================="
echo ""
echo "Starting Flask application..."
echo "Open your browser to: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run Flask
cd webapp
python app.py
EOF
chmod +x start-webapp.sh

# Create start-webapp-production script
cat > start-webapp-prod.sh << 'EOF'
#!/bin/bash
# Start the Mux Crawler Web Application (Production Mode)

cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Load environment variables
set -a
source .env
set +a

echo ""
echo "Starting Flask application with Gunicorn..."
echo "Open your browser to: http://localhost:5000"
echo ""

# Run with Gunicorn
cd webapp
gunicorn -w 2 -b 0.0.0.0:5000 app:app
EOF
chmod +x start-webapp-prod.sh

# Create run script
cat > run.sh << 'EOF'
#!/bin/bash
# Run the Mux crawler extraction (headless)

cd "$(dirname "$0")"

echo "Starting Mux Dashboard extraction..."
echo "This will open a browser for authentication on first run."
echo ""

npm run extract
EOF
chmod +x run.sh

# Create run-headed script (for debugging)
cat > run-headed.sh << 'EOF'
#!/bin/bash
# Run the Mux crawler with visible browser (for debugging)

cd "$(dirname "$0")"

echo "Starting Mux Dashboard extraction in headed mode..."
echo ""

npm run test:headed
EOF
chmod +x run-headed.sh

# Create authenticate script
cat > authenticate.sh << 'EOF'
#!/bin/bash
# Re-authenticate with Mux dashboard

cd "$(dirname "$0")"

# Remove existing session
rm -f auth/auth.json

echo "Launching browser for authentication..."
echo "Please log in to Mux dashboard and complete MFA."
echo ""

npm run test:headed
EOF
chmod +x authenticate.sh

# Create database status script
cat > db-status.sh << 'EOF'
#!/bin/bash
# Check database status and extraction progress

cd "$(dirname "$0")"

# Load environment variables
source .env 2>/dev/null

echo "Database: $DB_NAME"
echo ""

echo "=== Extraction Progress ==="
psql -d "$DB_NAME" -c "
SELECT
    status,
    COUNT(*) as count
FROM view_ingestion_status
GROUP BY status
ORDER BY status;
"

echo ""
echo "=== Recent Activity ==="
psql -d "$DB_NAME" -c "
SELECT
    view_id,
    status,
    updated_at
FROM view_ingestion_status
ORDER BY updated_at DESC
LIMIT 10;
"

echo ""
echo "=== Checkpoint ==="
psql -d "$DB_NAME" -c "
SELECT * FROM backfill_checkpoint;
"
EOF
chmod +x db-status.sh

# Create stop-webapp script
cat > stop-webapp.sh << 'EOF'
#!/bin/bash
# Stop the Mux Crawler Web Application

echo "Stopping Flask application..."
pkill -f "python.*app.py" 2>/dev/null || true
pkill -f "gunicorn.*app:app" 2>/dev/null || true
echo "Done"
EOF
chmod +x stop-webapp.sh

print_success "Helper scripts created"

#===============================================================================
# Summary
#===============================================================================

print_header "Installation Complete!"

echo -e "Installation directory: ${GREEN}$INSTALL_DIR/prova/mux-crawler${NC}"
echo ""
echo "=========================================="
echo "  NEXT STEPS"
echo "=========================================="
echo ""
echo -e "  1. ${YELLOW}Edit the .env file${NC} to update your database password:"
echo "     nano $INSTALL_DIR/prova/mux-crawler/.env"
echo ""
echo -e "  2. ${YELLOW}Start the Web UI${NC}:"
echo "     cd $INSTALL_DIR/prova/mux-crawler"
echo "     ./start-webapp.sh"
echo ""
echo "     Then open: http://localhost:5000"
echo ""
echo -e "  3. ${YELLOW}Authenticate with Mux${NC} (from Web UI or command line):"
echo "     ./authenticate.sh"
echo ""
echo "=========================================="
echo "  AVAILABLE SCRIPTS"
echo "=========================================="
echo ""
echo "  Web Application:"
echo "    ./start-webapp.sh      - Start web UI (development)"
echo "    ./start-webapp-prod.sh - Start web UI (production)"
echo "    ./stop-webapp.sh       - Stop web UI"
echo ""
echo "  Extraction (Command Line):"
echo "    ./run.sh               - Run extraction (headless)"
echo "    ./run-headed.sh        - Run with visible browser"
echo "    ./authenticate.sh      - Re-authenticate with Mux"
echo ""
echo "  Database:"
echo "    ./db-status.sh         - Check extraction progress"
echo ""
echo -e "${GREEN}=========================================="
echo "  Setup complete! Happy crawling!"
echo -e "==========================================${NC}"
