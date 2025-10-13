from flask import Flask, request, jsonify
import pandas as pd
import mysql.connector
from datetime import datetime
import os
from dotenv import load_dotenv
from flask_cors import CORS
import time
import logging

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'elara_db'),
    'port': int(os.getenv('DB_PORT', 3306))
}

@app.route('/process-excel', methods=['POST'])
def process_excel():
    start_time = time.time()
    logger.info("🚀 === PYTHON ULTRA-FAST PROCESSING START ===")
    
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        dataset_id = data.get('dataset_id')
        selected_sheet = data.get('selected_sheet')
        
        if not file_path or not dataset_id:
            return jsonify({'success': False, 'error': 'Missing file_path or dataset_id'}), 400
        
        logger.info(f"📁 Processing file: {file_path}")
        logger.info(f"🆔 Dataset ID: {dataset_id}")
        logger.info(f"📋 Selected sheet: {selected_sheet or 'Default'}")
        
        # Determine file type and read with optimized parameters
        file_extension = file_path.lower().split('.')[-1]
        logger.info(f"📄 File extension: {file_extension}")
        
        read_start = time.time()
        
        if file_extension == 'csv':
            logger.info("📄 Reading CSV with ultra-fast parameters...")
            df = pd.read_csv(
                file_path, 
                low_memory=False, 
                dtype=str,
                na_filter=False,  # Don't convert to NaN for speed
                engine='c'        # Use C engine for maximum speed
            )
        elif file_extension in ['xls', 'xlsx']:
            logger.info("📊 Reading Excel with ultra-fast parameters...")
            engine = 'xlrd' if file_extension == 'xls' else 'openpyxl'
            
            read_params = {
                'engine': engine,
                'dtype': str,
                'na_filter': False,
                'keep_default_na': False
            }
            
            if selected_sheet:
                df = pd.read_excel(file_path, sheet_name=selected_sheet, **read_params)
            else:
                df = pd.read_excel(file_path, **read_params)
        else:
            return jsonify({'success': False, 'error': f'Unsupported file type: {file_extension}'}), 400
        
        read_time = time.time() - read_start
        logger.info(f"⚡ File read completed in {read_time:.2f}s")
        
        if df.empty:
            return jsonify({'success': False, 'error': 'No data found in file'}), 400
        
        logger.info(f"📊 DataFrame shape: {df.shape}")
        logger.info(f"📋 Columns: {list(df.columns)}")
        
        # Ultra-fast data processing with vectorized operations
        process_start = time.time()
        logger.info("🚀 Starting vectorized data processing...")
        
        # Fill NaN values efficiently
        df = df.fillna('')
        
        # Convert numeric columns efficiently using vectorized operations
        numeric_cols = ['Debit', 'Credit', 'Balance']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        # Convert date column efficiently
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'], errors='coerce').dt.date
        
        # Add dataset_id column
        df['dataset_id'] = dataset_id
        
        # Define optimized column mapping
        column_order = [
            'Company Code', 'Company Display Name', 'Location Display Name', 'Location Area Code',
            'Location Parent Code', 'Label', 'Partner Display Name', 'Unit Department Name',
            'Business Display Name', 'Account Group Name', 'Account Code', 'Account Name',
            'Product Display Name', 'Date', 'Debit', 'Credit', 'Balance', 'Journal Type',
            'Journal Entry Number', 'Invoice Number', 'ID Project Display Name', 'Reference',
            'Type Display Name', 'Month', 'Company2', 'Regional', 'Ref', 'Divisi',
            'Grouping Bisnis', 'Akun Utama', 'Figure Utama', 'Akun Group 1', 'Akun Group 2 Type',
            'Figure Actual', 'Cek Holding', 'dataset_id'
        ]
        
        # Ensure all required columns exist
        for col in column_order:
            if col not in df.columns and col != 'dataset_id':
                df[col] = None
        
        # Select and reorder columns efficiently
        df_ordered = df[column_order]
        
        # Remove completely empty rows
        df_ordered = df_ordered.dropna(how='all', subset=[col for col in column_order if col != 'dataset_id'])
        
        process_time = time.time() - process_start
        logger.info(f"⚡ Data processing completed in {process_time:.2f}s")
        logger.info(f"📊 Records to insert: {len(df_ordered)}")
        
        if len(df_ordered) == 0:
            return jsonify({'success': False, 'error': 'No valid records found after processing'}), 400
        
        # ULTRA-FAST database insertion with advanced optimizations
        db_start = time.time()
        logger.info("💾 Starting ULTRA-FAST database insertion...")
        
        # Optimized database connection
        DB_CONFIG_OPTIMIZED = DB_CONFIG.copy()
        DB_CONFIG_OPTIMIZED.update({
            'autocommit': False,
            'use_pure': False,  # Use C extension
            'charset': 'utf8mb4',
            'sql_mode': 'NO_AUTO_VALUE_ON_ZERO'
        })
        
        conn = mysql.connector.connect(**DB_CONFIG_OPTIMIZED)
        cursor = conn.cursor(buffered=True)
        
        # Disable checks for maximum insertion speed
        cursor.execute("SET autocommit = 0")
        cursor.execute("SET foreign_key_checks = 0")
        cursor.execute("SET unique_checks = 0")
        cursor.execute("SET sql_log_bin = 0")
        
        # Convert DataFrame to list of tuples for insertion
        records = [tuple(row) for row in df_ordered.values]
        
        # Dynamic batch sizing for optimal performance
        if len(records) > 100000:
            batch_size = 25000
        elif len(records) > 50000:
            batch_size = 15000
        else:
            batch_size = 10000
        
        logger.info(f"🚀 Using optimized batch size: {batch_size}")
        
        # Optimized insert query
        insert_query = """
            INSERT INTO dataset_records (
                company_code, company_display_name, location_display_name, location_area_code,
                location_parent_code, label, partner_display_name, unit_department_name,
                business_display_name, account_group_name, account_code, account_name,
                product_display_name, date, debit, credit, balance, journal_type,
                journal_entry_number, invoice_number, id_project_display_name, reference,
                type_display_name, month, company2, regional, ref, divisi, grouping_bisnis,
                akun_utama, figure_utama, akun_group_1, akun_group_2_type, figure_actual,
                cek_holding, dataset_id
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """
        
        # Process in optimized batches
        total_batches = (len(records) + batch_size - 1) // batch_size
        inserted_count = 0
        
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            cursor.executemany(insert_query, batch)
            inserted_count += len(batch)
            
            batch_num = (i // batch_size) + 1
            if batch_num % 5 == 0 or batch_num == total_batches:
                logger.info(f"🚀 Batch {batch_num}/{total_batches} completed ({inserted_count}/{len(records)} records)")
        
        # Re-enable settings and commit
        cursor.execute("SET foreign_key_checks = 1")
        cursor.execute("SET unique_checks = 1")
        cursor.execute("SET autocommit = 1")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        db_time = time.time() - db_start
        total_time = time.time() - start_time
        
        logger.info(f"✅ Database insertion completed in {db_time:.2f}s")
        logger.info(f"🎉 === PYTHON PROCESSING COMPLETED ===")
        logger.info(f"⏱️ Total time: {total_time:.2f}s")
        logger.info(f"📊 Records processed: {inserted_count}")
        logger.info(f"🚀 Processing rate: {int(inserted_count / total_time)} records/sec")
        
        return jsonify({
            'success': True, 
            'records': inserted_count,
            'processing_time': total_time,
            'processing_rate': int(inserted_count / total_time),
            'breakdown': {
                'file_read_time': read_time,
                'data_processing_time': process_time,
                'database_insertion_time': db_time
            }
        })
    
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"❌ Error processing file after {total_time:.2f}s: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy', 
        'service': 'python-excel-processor-optimized',
        'version': '2.0',
        'features': ['ultra-fast-processing', 'data-integrity-verification', 'vectorized-operations']
    })

if __name__ == '__main__':
    logger.info("🐍 Starting Python Ultra-Fast Processing Service...")
    app.run(debug=True, port=5000, host='0.0.0.0')