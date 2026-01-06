"""Flask application configuration."""
import os
from dotenv import load_dotenv

# Load environment variables from parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql://postgres:password@localhost:5432/mux_analytics'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }

    # Mux Configuration
    MUX_ORG_ID = os.environ.get('MUX_ORG_ID', '')
    MUX_ENV_ID = os.environ.get('MUX_ENV_ID', '')
    MUX_USER_ID = os.environ.get('MUX_USER_ID', '')

    # Extraction Configuration
    EXTRACTION_START_DATE = os.environ.get('EXTRACTION_START_DATE', '2024-10-01')

    # Paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    AUTH_FILE = os.path.join(BASE_DIR, 'auth', 'auth.json')


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
