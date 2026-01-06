"""Flask application for Mux Dashboard Crawler."""
import os
import subprocess
import json
import signal
from datetime import datetime
from io import BytesIO
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
from models import (
    db, View, ViewIngestionStatus, BackfillCheckpoint,
    StartupTimeMetrics, SmoothnessMetrics, VideoQualityMetrics,
    DeviceDetails, ClientDetails, GeographyDetails, PlayerDetails,
    VideoMetadata, StreamDetails, NetworkDetails, AdsMetrics,
    CustomDetails, MODEL_REGISTRY
)
from config import config
import pandas as pd

# Global variable to track running extraction process
extraction_process = None


def create_app(config_name='default'):
    """Application factory."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)

    # Register routes
    register_routes(app)

    return app


def register_routes(app):
    """Register all routes."""

    @app.route('/')
    def index():
        """Dashboard home page."""
        # Get extraction status summary
        status_counts = db.session.query(
            ViewIngestionStatus.status,
            db.func.count(ViewIngestionStatus.view_id)
        ).group_by(ViewIngestionStatus.status).all()

        status_summary = {status: count for status, count in status_counts}

        # Get checkpoint
        checkpoint = BackfillCheckpoint.query.first()

        # Get total views
        total_views = View.query.count()

        # Get recent activity
        recent_activity = ViewIngestionStatus.query.order_by(
            ViewIngestionStatus.updated_at.desc()
        ).limit(10).all()

        # Check if extraction is running
        global extraction_process
        is_running = extraction_process is not None and extraction_process.poll() is None

        # Check auth status
        auth_file = app.config.get('AUTH_FILE', 'auth/auth.json')
        auth_exists = os.path.exists(auth_file)

        return render_template('index.html',
            status_summary=status_summary,
            checkpoint=checkpoint,
            total_views=total_views,
            recent_activity=recent_activity,
            is_running=is_running,
            auth_exists=auth_exists
        )

    @app.route('/extraction/start', methods=['POST'])
    def start_extraction():
        """Start the extraction process."""
        global extraction_process

        if extraction_process is not None and extraction_process.poll() is None:
            return jsonify({'error': 'Extraction already running'}), 400

        headed = request.json.get('headed', False)
        base_dir = app.config.get('BASE_DIR', os.path.dirname(os.path.dirname(__file__)))

        cmd = ['npm', 'run', 'test:headed' if headed else 'extract']

        try:
            extraction_process = subprocess.Popen(
                cmd,
                cwd=base_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            return jsonify({
                'status': 'started',
                'pid': extraction_process.pid,
                'headed': headed
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/extraction/stop', methods=['POST'])
    def stop_extraction():
        """Stop the extraction process."""
        global extraction_process

        if extraction_process is None:
            return jsonify({'error': 'No extraction running'}), 400

        try:
            extraction_process.terminate()
            extraction_process.wait(timeout=5)
            extraction_process = None
            return jsonify({'status': 'stopped'})
        except subprocess.TimeoutExpired:
            extraction_process.kill()
            extraction_process = None
            return jsonify({'status': 'killed'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/extraction/status')
    def extraction_status():
        """Get current extraction status."""
        global extraction_process

        is_running = extraction_process is not None and extraction_process.poll() is None

        # Get latest stats
        status_counts = db.session.query(
            ViewIngestionStatus.status,
            db.func.count(ViewIngestionStatus.view_id)
        ).group_by(ViewIngestionStatus.status).all()

        checkpoint = BackfillCheckpoint.query.first()

        return jsonify({
            'is_running': is_running,
            'status_counts': {status: count for status, count in status_counts},
            'checkpoint': checkpoint.last_processed_end.isoformat() if checkpoint else None,
            'total_views': View.query.count()
        })

    @app.route('/auth/status')
    def auth_status():
        """Check authentication status."""
        auth_file = app.config.get('AUTH_FILE', 'auth/auth.json')

        if not os.path.exists(auth_file):
            return jsonify({'authenticated': False, 'reason': 'No auth file'})

        try:
            with open(auth_file, 'r') as f:
                auth_data = json.load(f)

            # Check if cookies exist and haven't expired
            has_valid_cookies = any(
                cookie.get('expires', -1) == -1 or cookie.get('expires', 0) * 1000 > datetime.now().timestamp() * 1000
                for cookie in auth_data.get('cookies', [])
            )

            return jsonify({
                'authenticated': has_valid_cookies,
                'cookies_count': len(auth_data.get('cookies', [])),
                'file_exists': True
            })
        except Exception as e:
            return jsonify({'authenticated': False, 'error': str(e)})

    @app.route('/auth/clear', methods=['POST'])
    def clear_auth():
        """Clear authentication to force re-login."""
        auth_file = app.config.get('AUTH_FILE', 'auth/auth.json')

        if os.path.exists(auth_file):
            os.remove(auth_file)
            return jsonify({'status': 'cleared'})

        return jsonify({'status': 'no_auth_file'})

    @app.route('/data')
    def data_browser():
        """Data browser page."""
        tables = list(MODEL_REGISTRY.keys())
        return render_template('data.html', tables=tables)

    @app.route('/data/<table_name>')
    def view_table(table_name):
        """View data from a specific table."""
        if table_name not in MODEL_REGISTRY:
            return jsonify({'error': 'Invalid table'}), 404

        model = MODEL_REGISTRY[table_name]

        # Pagination
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        # Sorting
        sort_by = request.args.get('sort_by', 'view_id')
        sort_dir = request.args.get('sort_dir', 'desc')

        # Search/filter
        search = request.args.get('search', '')

        # Build query
        query = model.query

        # Apply search filter if provided
        if search and hasattr(model, 'view_id'):
            query = query.filter(model.view_id.ilike(f'%{search}%'))

        # Apply sorting
        if hasattr(model, sort_by):
            column = getattr(model, sort_by)
            if sort_dir == 'desc':
                query = query.order_by(column.desc())
            else:
                query = query.order_by(column.asc())

        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        # Get column names
        columns = [c.name for c in model.__table__.columns]

        # Convert to list of dicts
        data = []
        for row in pagination.items:
            row_dict = {}
            for col in columns:
                val = getattr(row, col)
                if isinstance(val, datetime):
                    val = val.isoformat()
                row_dict[col] = val
            data.append(row_dict)

        if request.headers.get('Accept') == 'application/json':
            return jsonify({
                'data': data,
                'columns': columns,
                'pagination': {
                    'page': pagination.page,
                    'pages': pagination.pages,
                    'total': pagination.total,
                    'per_page': per_page
                }
            })

        return render_template('table.html',
            table_name=table_name,
            columns=columns,
            data=data,
            pagination=pagination,
            sort_by=sort_by,
            sort_dir=sort_dir,
            search=search,
            tables=list(MODEL_REGISTRY.keys())
        )

    @app.route('/export', methods=['POST'])
    def export_data():
        """Export selected data to Excel."""
        export_config = request.json

        table_name = export_config.get('table')
        columns = export_config.get('columns', [])
        filters = export_config.get('filters', {})
        view_ids = export_config.get('view_ids', [])

        if table_name not in MODEL_REGISTRY:
            return jsonify({'error': 'Invalid table'}), 404

        model = MODEL_REGISTRY[table_name]

        # Build query
        query = model.query

        # Filter by specific view_ids if provided
        if view_ids:
            query = query.filter(model.view_id.in_(view_ids))

        # Apply other filters
        for col, val in filters.items():
            if hasattr(model, col):
                query = query.filter(getattr(model, col) == val)

        # Execute query
        results = query.all()

        # Build DataFrame
        if columns:
            data = [{col: getattr(row, col) for col in columns if hasattr(row, col)} for row in results]
        else:
            all_columns = [c.name for c in model.__table__.columns]
            data = [{col: getattr(row, col) for col in all_columns} for row in results]

        df = pd.DataFrame(data)

        # Generate Excel file
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=table_name[:31])

        output.seek(0)

        filename = f'mux_export_{table_name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    @app.route('/export/multi', methods=['POST'])
    def export_multi_table():
        """Export multiple tables to a single Excel file."""
        export_config = request.json
        tables_config = export_config.get('tables', [])

        output = BytesIO()

        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            for table_cfg in tables_config:
                table_name = table_cfg.get('table')
                columns = table_cfg.get('columns', [])
                view_ids = table_cfg.get('view_ids', [])

                if table_name not in MODEL_REGISTRY:
                    continue

                model = MODEL_REGISTRY[table_name]
                query = model.query

                if view_ids:
                    query = query.filter(model.view_id.in_(view_ids))

                results = query.all()

                if columns:
                    data = [{col: getattr(row, col) for col in columns if hasattr(row, col)} for row in results]
                else:
                    all_columns = [c.name for c in model.__table__.columns]
                    data = [{col: getattr(row, col) for col in all_columns} for row in results]

                df = pd.DataFrame(data)
                sheet_name = table_name[:31]  # Excel sheet name limit
                df.to_excel(writer, index=False, sheet_name=sheet_name)

        output.seek(0)

        filename = f'mux_export_multi_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    @app.route('/settings')
    def settings():
        """Settings page."""
        return render_template('settings.html',
            mux_org_id=app.config.get('MUX_ORG_ID', ''),
            mux_env_id=app.config.get('MUX_ENV_ID', ''),
            mux_user_id=app.config.get('MUX_USER_ID', ''),
            extraction_start_date=app.config.get('EXTRACTION_START_DATE', ''),
            database_url=app.config.get('SQLALCHEMY_DATABASE_URI', '').replace(
                app.config.get('SQLALCHEMY_DATABASE_URI', '').split(':')[2].split('@')[0],
                '****'
            ) if app.config.get('SQLALCHEMY_DATABASE_URI') else ''
        )

    @app.route('/api/stats')
    def api_stats():
        """API endpoint for dashboard statistics."""
        # Views by date
        views_by_date = db.session.query(
            db.func.date(View.started_at).label('date'),
            db.func.count(View.view_id).label('count')
        ).group_by(
            db.func.date(View.started_at)
        ).order_by(
            db.func.date(View.started_at).desc()
        ).limit(30).all()

        # Top countries
        top_countries = db.session.query(
            GeographyDetails.country,
            db.func.count(GeographyDetails.view_id).label('count')
        ).group_by(
            GeographyDetails.country
        ).order_by(
            db.func.count(GeographyDetails.view_id).desc()
        ).limit(10).all()

        # Average metrics
        avg_metrics = db.session.query(
            db.func.avg(StartupTimeMetrics.video_startup_time).label('avg_startup'),
            db.func.avg(SmoothnessMetrics.smoothness_score).label('avg_smoothness'),
            db.func.avg(VideoQualityMetrics.video_quality_score).label('avg_quality')
        ).first()

        return jsonify({
            'views_by_date': [{'date': str(d), 'count': c} for d, c in views_by_date if d],
            'top_countries': [{'country': c or 'Unknown', 'count': cnt} for c, cnt in top_countries],
            'avg_metrics': {
                'startup_time': round(avg_metrics.avg_startup, 2) if avg_metrics.avg_startup else None,
                'smoothness_score': round(avg_metrics.avg_smoothness, 2) if avg_metrics.avg_smoothness else None,
                'quality_score': round(avg_metrics.avg_quality, 2) if avg_metrics.avg_quality else None
            }
        })


# Create application instance
app = create_app(os.environ.get('FLASK_ENV', 'development'))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
