"""SQLAlchemy models for Mux analytics database."""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class View(db.Model):
    """Core view information."""
    __tablename__ = 'views'

    view_id = db.Column(db.Text, primary_key=True)
    started_at = db.Column(db.DateTime)
    ended_at = db.Column(db.DateTime)
    playing_time_seconds = db.Column(db.Integer)
    content_playing_time_seconds = db.Column(db.Integer)
    seeking_count = db.Column(db.Integer)
    seeking_duration_seconds = db.Column(db.Float)
    exited_before_video_start = db.Column(db.Boolean)
    view_has_ad = db.Column(db.Boolean)
    video_startup_failure = db.Column(db.Boolean)
    view_dropped = db.Column(db.Boolean)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    startup_metrics = db.relationship('StartupTimeMetrics', backref='view', uselist=False, lazy='joined')
    smoothness_metrics = db.relationship('SmoothnessMetrics', backref='view', uselist=False, lazy='joined')
    video_quality_metrics = db.relationship('VideoQualityMetrics', backref='view', uselist=False, lazy='joined')
    device_details = db.relationship('DeviceDetails', backref='view', uselist=False, lazy='joined')
    client_details = db.relationship('ClientDetails', backref='view', uselist=False, lazy='joined')
    geography_details = db.relationship('GeographyDetails', backref='view', uselist=False, lazy='joined')


class ViewIngestionStatus(db.Model):
    """Track extraction status for each view."""
    __tablename__ = 'view_ingestion_status'

    view_id = db.Column(db.Text, primary_key=True)
    status = db.Column(db.Text, nullable=False)
    retry_count = db.Column(db.Integer, default=0)
    last_error = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


class BackfillCheckpoint(db.Model):
    """Track extraction progress checkpoint."""
    __tablename__ = 'backfill_checkpoint'

    id = db.Column(db.Integer, primary_key=True)
    last_processed_end = db.Column(db.Date, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


class StartupTimeMetrics(db.Model):
    """Startup time metrics."""
    __tablename__ = 'startup_time_metrics'

    view_id = db.Column(db.Text, db.ForeignKey('views.view_id'), primary_key=True)
    startup_time_score = db.Column(db.Integer)
    video_startup_time = db.Column(db.Float)
    content_startup_time = db.Column(db.Float)
    player_start_time = db.Column(db.Integer)
    seek_latency_avg = db.Column(db.Float)
    seek_count = db.Column(db.Integer)
    seek_duration = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SmoothnessMetrics(db.Model):
    """Smoothness metrics."""
    __tablename__ = 'smoothness_metrics'

    id = db.Column(db.Integer, autoincrement=True)
    view_id = db.Column(db.Text, primary_key=True)
    smoothness_score = db.Column(db.Float)
    rebuffer_frequency = db.Column(db.Float)
    rebuffer_duration = db.Column(db.Float)
    rebuffer_count = db.Column(db.Integer)
    rendition_change_count = db.Column(db.Integer)
    rendition_upshift_count = db.Column(db.Integer)
    rendition_downshift_count = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VideoQualityMetrics(db.Model):
    """Video quality metrics."""
    __tablename__ = 'video_quality_metrics'

    view_id = db.Column(db.Text, primary_key=True)
    video_quality_score = db.Column(db.Integer)
    upscale_percentage = db.Column(db.Float)
    downscale_percentage = db.Column(db.Float)
    max_upscale_percentage = db.Column(db.Float)
    max_downscale_percentage = db.Column(db.Float)
    weighted_average_bitrate = db.Column(db.Float)
    request_throughput = db.Column(db.Float)
    request_latency = db.Column(db.Float)
    max_request_latency = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class DeviceDetails(db.Model):
    """Device information."""
    __tablename__ = 'device_details'

    view_id = db.Column(db.Text, primary_key=True)
    device_name = db.Column(db.Text)
    device_model = db.Column(db.Text)
    device_category = db.Column(db.Text)
    device_brand = db.Column(db.Text)
    full_user_agent = db.Column(db.Text)


class ClientDetails(db.Model):
    """Client/browser information."""
    __tablename__ = 'client_details'

    view_id = db.Column(db.Text, primary_key=True)
    browser = db.Column(db.Text)
    browser_version = db.Column(db.Text)
    os = db.Column(db.Text)
    os_version = db.Column(db.Text)
    page_type = db.Column(db.Text)


class PlayerDetails(db.Model):
    """Player information."""
    __tablename__ = 'player_details'

    view_id = db.Column(db.Text, primary_key=True)
    player_name = db.Column(db.Text)
    player_version = db.Column(db.Text)
    player_instance_id = db.Column(db.Text)
    software_name = db.Column(db.Text)
    software_version = db.Column(db.Text)
    player_height = db.Column(db.Integer)
    player_width = db.Column(db.Integer)
    player_language = db.Column(db.Text)
    mux_plugin = db.Column(db.Text)
    mux_plugin_version = db.Column(db.Text)


class OrganizationDetails(db.Model):
    """Organization information."""
    __tablename__ = 'organization_details'

    view_id = db.Column(db.Text, primary_key=True)
    sub_property_id = db.Column(db.Text)


class VideoMetadata(db.Model):
    """Video metadata."""
    __tablename__ = 'video_metadata'

    view_id = db.Column(db.Text, primary_key=True)
    video_title = db.Column(db.Text)
    video_series = db.Column(db.Text)
    video_id = db.Column(db.Text)
    content_type = db.Column(db.Text)


class StreamDetails(db.Model):
    """Stream information."""
    __tablename__ = 'stream_details'

    view_id = db.Column(db.Text, primary_key=True)
    video_stream_type = db.Column(db.Text)
    source_type = db.Column(db.Text)
    source_url = db.Column(db.Text)
    duration_seconds = db.Column(db.Integer)
    encoding_variant = db.Column(db.Text)
    drm_type = db.Column(db.Text)


class PlaybackDetails(db.Model):
    """Playback settings."""
    __tablename__ = 'playback_details'

    view_id = db.Column(db.Text, primary_key=True)
    remote_played = db.Column(db.Boolean)
    autoplay = db.Column(db.Boolean)
    preload = db.Column(db.Boolean)
    used_pip = db.Column(db.Boolean)
    used_captions = db.Column(db.Boolean)
    used_fullscreen = db.Column(db.Boolean)
    time_shift_enabled = db.Column(db.Boolean)


class RenditionDetails(db.Model):
    """Rendition information."""
    __tablename__ = 'rendition_details'

    view_id = db.Column(db.Text, primary_key=True)
    initial_bitrate = db.Column(db.Text)
    initial_framerate = db.Column(db.Text)
    bitrate = db.Column(db.Text)
    framerate = db.Column(db.Text)
    video_height = db.Column(db.Integer)
    video_width = db.Column(db.Integer)


class ViewerDetails(db.Model):
    """Viewer information."""
    __tablename__ = 'viewer_details'

    view_id = db.Column(db.Text, primary_key=True)
    viewer_id = db.Column(db.Text)


class NetworkDetails(db.Model):
    """Network information."""
    __tablename__ = 'network_details'

    view_id = db.Column(db.Text, primary_key=True)
    cdn = db.Column(db.Text)
    video_cdn_trace = db.Column(db.Text)
    asn = db.Column(db.Text)
    connection_type = db.Column(db.Text)
    source_hostname = db.Column(db.Text)
    view_session_id = db.Column(db.Text)


class GeographyDetails(db.Model):
    """Geography information."""
    __tablename__ = 'geography_details'

    view_id = db.Column(db.Text, primary_key=True)
    country = db.Column(db.Text)
    continent = db.Column(db.Text)
    city = db.Column(db.Text)
    region = db.Column(db.Text)
    latitude = db.Column(db.Text)
    longitude = db.Column(db.Text)


class AdsMetrics(db.Model):
    """Ads metrics."""
    __tablename__ = 'ads_metrics'

    id = db.Column(db.Integer, autoincrement=True)
    view_id = db.Column(db.Text, primary_key=True)
    ad_playing_time_seconds = db.Column(db.Float)
    preroll_requested = db.Column(db.Boolean)
    preroll_played = db.Column(db.Boolean)
    ad_attempts = db.Column(db.Integer)
    ad_impressions = db.Column(db.Integer)
    ad_breaks = db.Column(db.Integer)
    ad_error_percentage = db.Column(db.Float)
    ad_breaks_with_error_percentage = db.Column(db.Float)
    ad_startup_error_percentage = db.Column(db.Float)
    ad_exits_before_start = db.Column(db.Integer)
    ad_exits_before_start_percentage = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class CustomDetails(db.Model):
    """Custom metadata."""
    __tablename__ = 'custom_details'

    view_id = db.Column(db.Text, primary_key=True)
    selected_stream = db.Column(db.Text)
    config_name = db.Column(db.Text)
    ad_strategy = db.Column(db.Text)
    experiment_strategy = db.Column(db.Text)
    video_codec = db.Column(db.Text)
    audio_codec = db.Column(db.Text)
    video_dynamic_range = db.Column(db.Text)
    player_index = db.Column(db.Integer)


# Model registry for dynamic access
MODEL_REGISTRY = {
    'views': View,
    'view_ingestion_status': ViewIngestionStatus,
    'startup_time_metrics': StartupTimeMetrics,
    'smoothness_metrics': SmoothnessMetrics,
    'video_quality_metrics': VideoQualityMetrics,
    'device_details': DeviceDetails,
    'client_details': ClientDetails,
    'player_details': PlayerDetails,
    'organization_details': OrganizationDetails,
    'video_metadata': VideoMetadata,
    'stream_details': StreamDetails,
    'playback_details': PlaybackDetails,
    'rendition_details': RenditionDetails,
    'viewer_details': ViewerDetails,
    'network_details': NetworkDetails,
    'geography_details': GeographyDetails,
    'ads_metrics': AdsMetrics,
    'custom_details': CustomDetails,
}
