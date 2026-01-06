import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Type imports for metrics
import type { DeviceDetails } from '../scripts/deviceDetails.extractor.js';
import type { SmoothnessMetrics } from '../scripts/smoothness.extractor.js';
import type { StartupTimeMetrics } from '../scripts/startupTime.extractor.js';
import type { VideoQualityMetrics } from '../scripts/videoQuality.extractor.js';
import type { ClientDetails } from '../scripts/clientDetails.extractor.js';
import type { PlayerDetails } from '../scripts/playerDetails.extractor.js';
import type { OrganizationDetails } from '../scripts/organizationDetails.extractor.js';
import type { VideoMetadata } from '../scripts/videoMetadata.extractor.js';
import type { StreamDetails } from '../scripts/streamDetails.extractor.js';
import type { ViewDetails } from '../scripts/viewDetails.extractor.js';
import type { PlaybackDetails } from '../scripts/playbackDetails.extractor.js';
import type { RenditionDetails } from '../scripts/renditionDetails.extractor.js';
import type { ViewerDetails } from '../scripts/viewerDetails.extractor.js';
import type { NetworkDetails } from '../scripts/networkDetails.extractor.js';
import type { GeographyDetails } from '../scripts/geography.extractor.js';
import type { CustomDetails } from '../scripts/customDetails.extractor.js';
import type { AdsMetrics } from '../scripts/ads.extractor.js';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Validate database configuration
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not configured');
  console.error('Please set DATABASE_URL in your .env file');
  process.exit(1);
}

// Initialize connection pool with retry configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Log connection status
pool.on('connect', () => {
  console.log('Database: New client connected');
});

pool.on('error', (err) => {
  console.error('Database: Unexpected error on idle client', err);
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Database: Connection verified');
    return true;
  } catch (error) {
    console.error('Database: Connection failed', error);
    return false;
  }
}

/**
 * Close database pool (call on shutdown)
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database: Pool closed');
}

// ============================================================
// VIEW STATUS TRACKING
// ============================================================

export type ViewStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

/**
 * Check if a view has already been successfully processed
 */
export async function isViewAlreadyProcessed(viewId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM view_ingestion_status
     WHERE view_id = $1 AND status = 'SUCCESS'
     LIMIT 1`,
    [viewId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Update view processing status
 */
export async function markViewStatus(
  viewId: string,
  status: ViewStatus,
  error?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO view_ingestion_status (view_id, status, retry_count, last_error)
     VALUES ($1, $2, 0, $3)
     ON CONFLICT (view_id)
     DO UPDATE SET
       status = $2,
       retry_count = CASE
         WHEN $2 = 'FAILED' THEN view_ingestion_status.retry_count + 1
         ELSE view_ingestion_status.retry_count
       END,
       last_error = $3,
       updated_at = NOW()`,
    [viewId, status, error ?? null]
  );
}

/**
 * Get list of failed views for retry
 */
export async function getFailedViews(limit = 200): Promise<string[]> {
  const result = await pool.query(
    `SELECT view_id FROM view_ingestion_status
     WHERE status = 'FAILED' AND retry_count < 3
     ORDER BY updated_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map((r) => r.view_id);
}

// ============================================================
// CHECKPOINT MANAGEMENT
// ============================================================

/**
 * Get the last checkpoint date
 */
export async function getCheckpoint(): Promise<Date | null> {
  const result = await pool.query(
    `SELECT last_processed_end FROM backfill_checkpoint WHERE id = 1`
  );

  if (result.rowCount === 0) return null;

  const raw = result.rows[0].last_processed_end;
  const date = raw instanceof Date ? raw : new Date(raw);

  return isNaN(date.getTime()) ? null : date;
}

/**
 * Save checkpoint date (prevents duplicates by storing max date)
 */
export async function saveCheckpoint(date: Date): Promise<void> {
  const now = new Date();
  const safeDate = date > now ? now : date;
  const utcDate = new Date(safeDate.toISOString());

  await pool.query(
    `INSERT INTO backfill_checkpoint (id, last_processed_end)
     VALUES (1, $1)
     ON CONFLICT (id)
     DO UPDATE SET
       last_processed_end = GREATEST(
         backfill_checkpoint.last_processed_end,
         EXCLUDED.last_processed_end
       ),
       updated_at = NOW()`,
    [utcDate]
  );
}

// ============================================================
// METRICS INSERT FUNCTIONS
// ============================================================

export async function insertViewDetails(data: ViewDetails): Promise<void> {
  await pool.query(
    `INSERT INTO views (
      view_id, started_at, ended_at, playing_time_seconds,
      content_playing_time_seconds, seeking_count, seeking_duration_seconds,
      exited_before_video_start, view_has_ad, video_startup_failure, view_dropped
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (view_id) DO UPDATE SET
      started_at = EXCLUDED.started_at,
      ended_at = EXCLUDED.ended_at,
      playing_time_seconds = EXCLUDED.playing_time_seconds,
      content_playing_time_seconds = EXCLUDED.content_playing_time_seconds,
      seeking_count = EXCLUDED.seeking_count,
      seeking_duration_seconds = EXCLUDED.seeking_duration_seconds,
      exited_before_video_start = EXCLUDED.exited_before_video_start,
      view_has_ad = EXCLUDED.view_has_ad,
      video_startup_failure = EXCLUDED.video_startup_failure,
      view_dropped = EXCLUDED.view_dropped`,
    [
      data.view_id,
      data.started_at,
      data.ended_at,
      data.playing_time_seconds,
      data.content_playing_time_seconds,
      data.seeking_count,
      data.seeking_duration_seconds,
      data.exited_before_video_start,
      data.view_has_ad,
      data.video_startup_failure,
      data.view_dropped,
    ]
  );
}

export async function insertStartupTimeMetrics(data: StartupTimeMetrics): Promise<void> {
  await pool.query(
    `INSERT INTO startup_time_metrics (
      view_id, startup_time_score, video_startup_time, content_startup_time,
      player_start_time, seek_latency_avg, seek_count, seek_duration
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (view_id) DO UPDATE SET
      startup_time_score = EXCLUDED.startup_time_score,
      video_startup_time = EXCLUDED.video_startup_time,
      content_startup_time = EXCLUDED.content_startup_time,
      player_start_time = EXCLUDED.player_start_time,
      seek_latency_avg = EXCLUDED.seek_latency_avg,
      seek_count = EXCLUDED.seek_count,
      seek_duration = EXCLUDED.seek_duration`,
    [
      data.view_id,
      data.startup_time_score,
      data.video_startup_time,
      data.content_startup_time,
      data.player_start_time,
      data.seek_latency_avg,
      data.seek_count,
      data.seek_duration,
    ]
  );
}

export async function insertSmoothnessMetrics(data: SmoothnessMetrics): Promise<void> {
  await pool.query(
    `INSERT INTO smoothness_metrics (
      view_id, smoothness_score, rebuffer_frequency, rebuffer_duration,
      rebuffer_count, rendition_change_count, rendition_upshift_count,
      rendition_downshift_count
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (view_id) DO UPDATE SET
      smoothness_score = EXCLUDED.smoothness_score,
      rebuffer_frequency = EXCLUDED.rebuffer_frequency,
      rebuffer_duration = EXCLUDED.rebuffer_duration,
      rebuffer_count = EXCLUDED.rebuffer_count,
      rendition_change_count = EXCLUDED.rendition_change_count,
      rendition_upshift_count = EXCLUDED.rendition_upshift_count,
      rendition_downshift_count = EXCLUDED.rendition_downshift_count`,
    [
      data.view_id,
      data.smoothness_score,
      data.rebuffer_frequency,
      data.rebuffer_duration,
      data.rebuffer_count,
      data.rendition_change_count,
      data.rendition_upshift_count,
      data.rendition_downshift_count,
    ]
  );
}

export async function insertVideoQualityMetrics(data: VideoQualityMetrics): Promise<void> {
  await pool.query(
    `INSERT INTO video_quality_metrics (
      view_id, video_quality_score, upscale_percentage, downscale_percentage,
      max_upscale_percentage, max_downscale_percentage, weighted_average_bitrate,
      request_throughput, request_latency, max_request_latency
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (view_id) DO UPDATE SET
      video_quality_score = EXCLUDED.video_quality_score,
      upscale_percentage = EXCLUDED.upscale_percentage,
      downscale_percentage = EXCLUDED.downscale_percentage,
      max_upscale_percentage = EXCLUDED.max_upscale_percentage,
      max_downscale_percentage = EXCLUDED.max_downscale_percentage,
      weighted_average_bitrate = EXCLUDED.weighted_average_bitrate,
      request_throughput = EXCLUDED.request_throughput,
      request_latency = EXCLUDED.request_latency,
      max_request_latency = EXCLUDED.max_request_latency`,
    [
      data.view_id,
      data.video_quality_score,
      data.upscale_percentage,
      data.downscale_percentage,
      data.max_upscale_percentage,
      data.max_downscale_percentage,
      data.weighted_average_bitrate,
      data.request_throughput,
      data.request_latency,
      data.max_request_latency,
    ]
  );
}

export async function insertDeviceDetails(data: DeviceDetails): Promise<void> {
  await pool.query(
    `INSERT INTO device_details (
      view_id, device_name, device_model, device_category, device_brand, full_user_agent
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (view_id) DO UPDATE SET
      device_name = EXCLUDED.device_name,
      device_model = EXCLUDED.device_model,
      device_category = EXCLUDED.device_category,
      device_brand = EXCLUDED.device_brand,
      full_user_agent = EXCLUDED.full_user_agent`,
    [
      data.view_id,
      data.device_name,
      data.device_model,
      data.device_category,
      data.device_brand,
      data.full_user_agent,
    ]
  );
}

export async function insertClientDetails(data: ClientDetails): Promise<void> {
  await pool.query(
    `INSERT INTO client_details (
      view_id, browser, browser_version, os, os_version, page_type
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (view_id) DO UPDATE SET
      browser = EXCLUDED.browser,
      browser_version = EXCLUDED.browser_version,
      os = EXCLUDED.os,
      os_version = EXCLUDED.os_version,
      page_type = EXCLUDED.page_type`,
    [
      data.view_id,
      data.browser,
      data.browser_version,
      data.os,
      data.os_version,
      data.page_type,
    ]
  );
}

export async function insertPlayerDetails(data: PlayerDetails): Promise<void> {
  await pool.query(
    `INSERT INTO player_details (
      view_id, player_name, player_version, player_instance_id,
      software_name, software_version, player_height, player_width,
      player_language, mux_plugin, mux_plugin_version
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (view_id) DO UPDATE SET
      player_name = EXCLUDED.player_name,
      player_version = EXCLUDED.player_version,
      player_instance_id = EXCLUDED.player_instance_id,
      software_name = EXCLUDED.software_name,
      software_version = EXCLUDED.software_version,
      player_height = EXCLUDED.player_height,
      player_width = EXCLUDED.player_width,
      player_language = EXCLUDED.player_language,
      mux_plugin = EXCLUDED.mux_plugin,
      mux_plugin_version = EXCLUDED.mux_plugin_version`,
    [
      data.view_id,
      data.player_name,
      data.player_version,
      data.player_instance_id,
      data.software_name,
      data.software_version,
      data.player_height,
      data.player_width,
      data.player_language,
      data.mux_plugin,
      data.mux_plugin_version,
    ]
  );
}

export async function insertOrganizationDetails(data: OrganizationDetails): Promise<void> {
  await pool.query(
    `INSERT INTO organization_details (view_id, sub_property_id)
     VALUES ($1, $2)
     ON CONFLICT (view_id) DO UPDATE SET
       sub_property_id = EXCLUDED.sub_property_id`,
    [data.view_id, data.sub_property_id]
  );
}

export async function insertVideoMetadata(data: VideoMetadata): Promise<void> {
  await pool.query(
    `INSERT INTO video_metadata (
      view_id, video_title, video_series, video_id, content_type
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (view_id) DO UPDATE SET
      video_title = EXCLUDED.video_title,
      video_series = EXCLUDED.video_series,
      video_id = EXCLUDED.video_id,
      content_type = EXCLUDED.content_type`,
    [
      data.view_id,
      data.video_title,
      data.video_series,
      data.video_id,
      data.content_type,
    ]
  );
}

export async function insertStreamDetails(data: StreamDetails): Promise<void> {
  await pool.query(
    `INSERT INTO stream_details (
      view_id, video_stream_type, source_type, source_url,
      duration_seconds, encoding_variant, drm_type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (view_id) DO UPDATE SET
      video_stream_type = EXCLUDED.video_stream_type,
      source_type = EXCLUDED.source_type,
      source_url = EXCLUDED.source_url,
      duration_seconds = EXCLUDED.duration_seconds,
      encoding_variant = EXCLUDED.encoding_variant,
      drm_type = EXCLUDED.drm_type`,
    [
      data.view_id,
      data.video_stream_type,
      data.source_type,
      data.source_url,
      data.duration_seconds,
      data.encoding_variant,
      data.drm_type,
    ]
  );
}

export async function insertPlaybackDetails(data: PlaybackDetails): Promise<void> {
  await pool.query(
    `INSERT INTO playback_details (
      view_id, remote_played, autoplay, preload,
      used_pip, used_captions, used_fullscreen, time_shift_enabled
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (view_id) DO UPDATE SET
      remote_played = EXCLUDED.remote_played,
      autoplay = EXCLUDED.autoplay,
      preload = EXCLUDED.preload,
      used_pip = EXCLUDED.used_pip,
      used_captions = EXCLUDED.used_captions,
      used_fullscreen = EXCLUDED.used_fullscreen,
      time_shift_enabled = EXCLUDED.time_shift_enabled`,
    [
      data.view_id,
      data.remote_played,
      data.autoplay,
      data.preload,
      data.used_pip,
      data.used_captions,
      data.used_fullscreen,
      data.time_shift_enabled,
    ]
  );
}

export async function insertRenditionDetails(data: RenditionDetails): Promise<void> {
  await pool.query(
    `INSERT INTO rendition_details (
      view_id, initial_bitrate, initial_framerate,
      bitrate, framerate, video_height, video_width
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (view_id) DO UPDATE SET
      initial_bitrate = EXCLUDED.initial_bitrate,
      initial_framerate = EXCLUDED.initial_framerate,
      bitrate = EXCLUDED.bitrate,
      framerate = EXCLUDED.framerate,
      video_height = EXCLUDED.video_height,
      video_width = EXCLUDED.video_width`,
    [
      data.view_id,
      data.initial_bitrate,
      data.initial_framerate,
      data.bitrate,
      data.framerate,
      data.video_height,
      data.video_width,
    ]
  );
}

export async function insertViewerDetails(data: ViewerDetails): Promise<void> {
  await pool.query(
    `INSERT INTO viewer_details (view_id, viewer_id)
     VALUES ($1, $2)
     ON CONFLICT (view_id) DO UPDATE SET
       viewer_id = EXCLUDED.viewer_id`,
    [data.view_id, data.viewer_id]
  );
}

export async function insertNetworkDetails(data: NetworkDetails): Promise<void> {
  await pool.query(
    `INSERT INTO network_details (
      view_id, cdn, video_cdn_trace, asn,
      connection_type, source_hostname, view_session_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (view_id) DO UPDATE SET
      cdn = EXCLUDED.cdn,
      video_cdn_trace = EXCLUDED.video_cdn_trace,
      asn = EXCLUDED.asn,
      connection_type = EXCLUDED.connection_type,
      source_hostname = EXCLUDED.source_hostname,
      view_session_id = EXCLUDED.view_session_id`,
    [
      data.view_id,
      data.cdn,
      data.video_cdn_trace,
      data.asn,
      data.connection_type,
      data.source_hostname,
      data.view_session_id,
    ]
  );
}

export async function insertGeographyDetails(data: GeographyDetails): Promise<void> {
  await pool.query(
    `INSERT INTO geography_details (
      view_id, country, continent, city, region, latitude, longitude
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (view_id) DO UPDATE SET
      country = EXCLUDED.country,
      continent = EXCLUDED.continent,
      city = EXCLUDED.city,
      region = EXCLUDED.region,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude`,
    [
      data.view_id,
      data.country,
      data.continent,
      data.city,
      data.region,
      data.latitude,
      data.longitude,
    ]
  );
}

export async function insertAdsMetrics(data: AdsMetrics): Promise<void> {
  await pool.query(
    `INSERT INTO ads_metrics (
      view_id, ad_playing_time_seconds, preroll_requested, preroll_played,
      ad_attempts, ad_impressions, ad_breaks, ad_error_percentage,
      ad_breaks_with_error_percentage, ad_startup_error_percentage,
      ad_exits_before_start, ad_exits_before_start_percentage
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (view_id) DO UPDATE SET
      ad_playing_time_seconds = EXCLUDED.ad_playing_time_seconds,
      preroll_requested = EXCLUDED.preroll_requested,
      preroll_played = EXCLUDED.preroll_played,
      ad_attempts = EXCLUDED.ad_attempts,
      ad_impressions = EXCLUDED.ad_impressions,
      ad_breaks = EXCLUDED.ad_breaks,
      ad_error_percentage = EXCLUDED.ad_error_percentage,
      ad_breaks_with_error_percentage = EXCLUDED.ad_breaks_with_error_percentage,
      ad_startup_error_percentage = EXCLUDED.ad_startup_error_percentage,
      ad_exits_before_start = EXCLUDED.ad_exits_before_start,
      ad_exits_before_start_percentage = EXCLUDED.ad_exits_before_start_percentage`,
    [
      data.view_id,
      data.ad_playing_time_seconds,
      data.preroll_requested,
      data.preroll_played,
      data.ad_attempts,
      data.ad_impressions,
      data.ad_breaks,
      data.ad_error_percentage,
      data.ad_breaks_with_error_percentage,
      data.ad_startup_error_percentage,
      data.ad_exits_before_start,
      data.ad_exits_before_start_percentage,
    ]
  );
}

export async function insertCustomDetails(data: CustomDetails): Promise<void> {
  await pool.query(
    `INSERT INTO custom_details (
      view_id, selected_stream, config_name, ad_strategy,
      experiment_strategy, video_codec, audio_codec,
      video_dynamic_range, player_index
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (view_id) DO UPDATE SET
      selected_stream = EXCLUDED.selected_stream,
      config_name = EXCLUDED.config_name,
      ad_strategy = EXCLUDED.ad_strategy,
      experiment_strategy = EXCLUDED.experiment_strategy,
      video_codec = EXCLUDED.video_codec,
      audio_codec = EXCLUDED.audio_codec,
      video_dynamic_range = EXCLUDED.video_dynamic_range,
      player_index = EXCLUDED.player_index`,
    [
      data.view_id,
      data.selected_stream,
      data.config_name,
      data.ad_strategy,
      data.experiment_strategy,
      data.video_codec,
      data.audio_codec,
      data.video_dynamic_range,
      data.player_index,
    ]
  );
}
