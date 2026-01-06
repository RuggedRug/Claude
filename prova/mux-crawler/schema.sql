-- Mux Dashboard Crawler - Database Schema
-- PostgreSQL 14+

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Main views table
CREATE TABLE IF NOT EXISTS views (
    view_id TEXT PRIMARY KEY,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    playing_time_seconds INTEGER,
    content_playing_time_seconds INTEGER,
    seeking_count INTEGER,
    seeking_duration_seconds REAL,
    exited_before_video_start BOOLEAN,
    view_has_ad BOOLEAN,
    video_startup_failure BOOLEAN,
    view_dropped BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- View ingestion status tracking
CREATE TABLE IF NOT EXISTS view_ingestion_status (
    view_id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')),
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_view_ingestion_status ON view_ingestion_status(status);

-- Backfill checkpoint
CREATE TABLE IF NOT EXISTS backfill_checkpoint (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_processed_end DATE NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
);

-- ============================================================
-- METRICS TABLES
-- ============================================================

-- Startup time metrics
CREATE TABLE IF NOT EXISTS startup_time_metrics (
    view_id TEXT PRIMARY KEY REFERENCES views(view_id) ON DELETE CASCADE,
    startup_time_score INTEGER,
    video_startup_time REAL,
    content_startup_time REAL,
    player_start_time INTEGER,
    seek_latency_avg REAL,
    seek_count INTEGER,
    seek_duration INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Smoothness metrics
CREATE TABLE IF NOT EXISTS smoothness_metrics (
    id SERIAL,
    view_id TEXT PRIMARY KEY,
    smoothness_score REAL,
    rebuffer_frequency REAL,
    rebuffer_duration REAL,
    rebuffer_count INTEGER,
    rendition_change_count INTEGER,
    rendition_upshift_count INTEGER,
    rendition_downshift_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video quality metrics
CREATE TABLE IF NOT EXISTS video_quality_metrics (
    view_id TEXT PRIMARY KEY,
    video_quality_score INTEGER,
    upscale_percentage REAL,
    downscale_percentage REAL,
    max_upscale_percentage REAL,
    max_downscale_percentage REAL,
    weighted_average_bitrate REAL,
    request_throughput REAL,
    request_latency REAL,
    max_request_latency REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ads metrics
CREATE TABLE IF NOT EXISTS ads_metrics (
    id SERIAL,
    view_id TEXT PRIMARY KEY,
    ad_playing_time_seconds REAL,
    preroll_requested BOOLEAN,
    preroll_played BOOLEAN,
    ad_attempts INTEGER,
    ad_impressions INTEGER,
    ad_breaks INTEGER,
    ad_error_percentage REAL,
    ad_breaks_with_error_percentage REAL,
    ad_startup_error_percentage REAL,
    ad_exits_before_start INTEGER,
    ad_exits_before_start_percentage REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DETAIL TABLES
-- ============================================================

-- Device details
CREATE TABLE IF NOT EXISTS device_details (
    view_id TEXT PRIMARY KEY,
    device_name TEXT,
    device_model TEXT,
    device_category TEXT,
    device_brand TEXT,
    full_user_agent TEXT
);

-- Client details
CREATE TABLE IF NOT EXISTS client_details (
    view_id TEXT PRIMARY KEY,
    browser TEXT,
    browser_version TEXT,
    os TEXT,
    os_version TEXT,
    page_type TEXT
);

-- Player details
CREATE TABLE IF NOT EXISTS player_details (
    view_id TEXT PRIMARY KEY,
    player_name TEXT,
    player_version TEXT,
    player_instance_id TEXT,
    software_name TEXT,
    software_version TEXT,
    player_height INTEGER,
    player_width INTEGER,
    player_language TEXT,
    mux_plugin TEXT,
    mux_plugin_version TEXT
);

-- Organization details
CREATE TABLE IF NOT EXISTS organization_details (
    view_id TEXT PRIMARY KEY,
    sub_property_id TEXT
);

-- Video metadata
CREATE TABLE IF NOT EXISTS video_metadata (
    view_id TEXT PRIMARY KEY,
    video_title TEXT,
    video_series TEXT,
    video_id TEXT,
    content_type TEXT
);

-- Stream details
CREATE TABLE IF NOT EXISTS stream_details (
    view_id TEXT PRIMARY KEY,
    video_stream_type TEXT,
    source_type TEXT,
    source_url TEXT,
    duration_seconds INTEGER,
    encoding_variant TEXT,
    drm_type TEXT
);

-- Playback details
CREATE TABLE IF NOT EXISTS playback_details (
    view_id TEXT PRIMARY KEY,
    remote_played BOOLEAN,
    autoplay BOOLEAN,
    preload BOOLEAN,
    used_pip BOOLEAN,
    used_captions BOOLEAN,
    used_fullscreen BOOLEAN,
    time_shift_enabled BOOLEAN
);

-- Rendition details
CREATE TABLE IF NOT EXISTS rendition_details (
    view_id TEXT PRIMARY KEY,
    initial_bitrate TEXT,
    initial_framerate TEXT,
    bitrate TEXT,
    framerate TEXT,
    video_height INTEGER,
    video_width INTEGER
);

-- Viewer details
CREATE TABLE IF NOT EXISTS viewer_details (
    view_id TEXT PRIMARY KEY,
    viewer_id TEXT
);

-- Network details
CREATE TABLE IF NOT EXISTS network_details (
    view_id TEXT PRIMARY KEY,
    cdn TEXT,
    video_cdn_trace TEXT,
    asn TEXT,
    connection_type TEXT,
    source_hostname TEXT,
    view_session_id TEXT
);

-- Geography details
CREATE TABLE IF NOT EXISTS geography_details (
    view_id TEXT PRIMARY KEY,
    country TEXT,
    continent TEXT,
    city TEXT,
    region TEXT,
    latitude TEXT,
    longitude TEXT
);

-- Custom details
CREATE TABLE IF NOT EXISTS custom_details (
    view_id TEXT PRIMARY KEY,
    selected_stream TEXT,
    config_name TEXT,
    ad_strategy TEXT,
    experiment_strategy TEXT,
    video_codec TEXT,
    audio_codec TEXT,
    video_dynamic_range TEXT,
    player_index INTEGER
);

-- ============================================================
-- INDEXES FOR COMMON QUERIES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_views_started_at ON views(started_at);
CREATE INDEX IF NOT EXISTS idx_views_ended_at ON views(ended_at);
CREATE INDEX IF NOT EXISTS idx_video_metadata_video_id ON video_metadata(video_id);
CREATE INDEX IF NOT EXISTS idx_viewer_details_viewer_id ON viewer_details(viewer_id);
CREATE INDEX IF NOT EXISTS idx_geography_country ON geography_details(country);

-- ============================================================
-- ANALYTICS VIEW
-- ============================================================

CREATE OR REPLACE VIEW full_view_data AS
SELECT
    v.view_id,
    v.started_at,
    v.ended_at,
    v.playing_time_seconds,
    v.content_playing_time_seconds,

    -- Startup metrics
    stm.startup_time_score,
    stm.video_startup_time,
    stm.content_startup_time,

    -- Smoothness metrics
    sm.smoothness_score,
    sm.rebuffer_frequency,
    sm.rebuffer_duration,
    sm.rebuffer_count,
    sm.rendition_change_count,

    -- Video quality
    vqm.video_quality_score,
    vqm.upscale_percentage,
    vqm.downscale_percentage,
    vqm.weighted_average_bitrate,

    -- Device info
    dd.device_name,
    dd.device_category,

    -- Client info
    cd.browser,
    cd.os,

    -- Geography
    gd.country,
    gd.city

FROM views v
LEFT JOIN startup_time_metrics stm ON stm.view_id = v.view_id
LEFT JOIN smoothness_metrics sm ON sm.view_id = v.view_id
LEFT JOIN video_quality_metrics vqm ON vqm.view_id = v.view_id
LEFT JOIN device_details dd ON dd.view_id = v.view_id
LEFT JOIN client_details cd ON cd.view_id = v.view_id
LEFT JOIN geography_details gd ON gd.view_id = v.view_id;
