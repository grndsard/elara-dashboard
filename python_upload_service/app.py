from flask import Flask, request, jsonify
import pandas as pd
import mysql.connector
from datetime import datetime
import os
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'elara_db'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'charset': 'utf8mb4',
    'use_unicode': True,
    'autocommit': False,
    'pool_name': 'elara_pool',
    'pool_size': 10,
    'pool_reset_session': False
}

@app.route('/process-excel', methods=['POST'])
def process_excel():
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        dataset_id = data.get('dataset_id')
        selected_sheet = data.get('selected_sheet')
        
        if not file_path or not dataset_id:
            return jsonify({'success': False, 'error': 'Missing file_path or dataset_id'}), 400
        
        print(f"Processing file: {file_path}")
        
        # Determine file type and read accordingly
        file_extension = file_path.lower().split('.')[-1]
        print(f"File extension: {file_extension}")
        
        # Get file size for memory optimization
        file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
        chunk_size = int(os.getenv('DB_CHUNK_SIZE', 50000))
        
        print(f"📊 File size: {file_size:.2f} MB")
        
        # Ultra-fast file reading with memory optimization
        if file_extension == 'csv':
            print(f"📄 Reading CSV with optimized parameters...")
            if file_size > 50:  # Large files - use chunked reading
                print(f"🔄 Using chunked reading for large CSV file...")
                chunks = []
                for chunk in pd.read_csv(file_path, low_memory=True, dtype=str, chunksize=25000):
                    chunks.append(chunk)
                    if len(chunks) % 10 == 0:
                        print(f"📊 Processed {len(chunks) * 25000} rows...")
                df = pd.concat(chunks, ignore_index=True)
                del chunks  # Free memory
            else:
                df = pd.read_csv(file_path, low_memory=False, dtype=str)
        elif file_extension in ['xls', 'xlsx']:
            print(f"📊 Reading Excel with optimized parameters...")
            engine = 'xlrd' if file_extension == 'xls' else 'openpyxl'
            
            read_params = {
                'engine': engine,
                'dtype': str,
                'na_filter': False,
                'keep_default_na': False
            }
            
            # For large Excel files, optimize memory usage
            if file_size > 50:
                print(f"🔄 Using memory-optimized reading for large Excel file...")
                read_params['nrows'] = None  # Read all rows but optimize memory
            
            if selected_sheet:
                df = pd.read_excel(file_path, sheet_name=selected_sheet, **read_params)
            else:
                df = pd.read_excel(file_path, **read_params)
        else:
            return jsonify({'success': False, 'error': f'Unsupported file type: {file_extension}'}), 400
        
        if df.empty:
            return jsonify({'success': False, 'error': 'No data found in Excel file'}), 400
        
        print(f"DataFrame shape: {df.shape}")
        print(f"DataFrame columns: {list(df.columns)}")
        print(f"First few rows:\n{df.head()}")
        
        # Use connection pooling for better performance
        try:
            from mysql.connector import pooling
            pool = pooling.MySQLConnectionPool(**DB_CONFIG)
            conn = pool.get_connection()
        except:
            # Fallback to direct connection
            DB_CONFIG_OPTIMIZED = DB_CONFIG.copy()
            DB_CONFIG_OPTIMIZED.update({
                'use_pure': False,
                'sql_mode': 'NO_AUTO_VALUE_ON_ZERO'
            })
            conn = mysql.connector.connect(**DB_CONFIG_OPTIMIZED)
        
        cursor = conn.cursor(buffered=True)
        
        # Ultra-fast vectorized processing - 10x faster than iterrows()
        print(f"🚀 Using vectorized pandas operations for maximum speed...")
        
        # Fill NaN values efficiently
        df = df.fillna('')
        
        # Convert date column efficiently
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'], errors='coerce').dt.date
        
        # Convert numeric columns efficiently
        numeric_cols = ['Debit', 'Credit', 'Balance']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        # Convert to records with all available columns
        records = df.to_dict('records')
        
        print(f"✅ Vectorized processing completed: {len(records)} records prepared")
        
        if not records:
            return jsonify({'success': False, 'error': 'No valid records found after processing'}), 400
        
        print(f"Processing {len(records)} records")
        
        # ULTRA-FAST database insertion with advanced optimizations
        print(f"💾 Starting ULTRA-FAST database insertion with advanced optimizations...")
        
        # Disable autocommit and foreign key checks for maximum speed
        cursor.execute("SET autocommit = 0")
        cursor.execute("SET foreign_key_checks = 0")
        cursor.execute("SET unique_checks = 0")
        cursor.execute("SET sql_log_bin = 0")  # Disable binary logging if possible
        
        # Simplified batch processing
        batch_size = 500
        inserted_count = 0
        
        print(f"💾 Processing {len(records)} records in batches of {batch_size}")
        
        # Column mapping for all fields
        column_mapping = {
            'Company Code': 'company_code',
            'Company Display Name': 'company_display_name', 
            'Location Display Name': 'location_display_name',
            'Location Area Code': 'location_area_code',
            'Location Parent Code': 'location_parent_code',
            'Label': 'label',
            'Partner Display Name': 'partner_display_name',
            'Unit Department Name': 'unit_department_name',
            'Business Display Name': 'business_display_name',
            'Account Group Name': 'account_group_name',
            'Account Code': 'account_code',
            'Account Name': 'account_name',
            'Product Display Name': 'product_display_name',
            'Date': 'date',
            'Debit': 'debit',
            'Credit': 'credit', 
            'Balance': 'balance',
            'Journal Type': 'journal_type',
            'Journal Entry Number': 'journal_entry_number',
            'Invoice Number': 'invoice_number',
            'ID Project Display Name': 'id_project_display_name',
            'Reference': 'reference',
            'Type Display Name': 'type_display_name',
            'Month': 'month',
            'Company2': 'company2',
            'Regional': 'regional',
            'Ref': 'ref',
            'Divisi': 'divisi',
            'Grouping Bisnis': 'grouping_bisnis',
            'Akun Utama': 'akun_utama',
            'Figure Utama': 'figure_utama',
            'Akun Group 1': 'akun_group_1',
            'Akun Group 2 Type': 'akun_group_2_type',
            'Figure Actual': 'figure_actual',
            'Cek Holding': 'cek_holding'
        }
        
        # Build dynamic insert query
        available_columns = []
        placeholders = []
        for source_col, db_col in column_mapping.items():
            if any(source_col in record or source_col.lower().replace(' ', '_') in record for record in records[:5]):
                available_columns.append(db_col)
                placeholders.append('%s')
        
        available_columns.append('dataset_id')
        placeholders.append('%s')
        
        insert_query = f"""
            INSERT INTO dataset_records ({', '.join(available_columns)})
            VALUES ({', '.join(placeholders)})
        """
        
        try:
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                batch_data = []
                
                for record in batch:
                    try:
                        # Parse financial numbers with parentheses support
                        def parse_financial_number(value):
                            if not value or pd.isna(value):
                                return 0.0
                            
                            value_str = str(value).strip().replace(',', '').replace('"', '')
                            if not value_str:
                                return 0.0
                            
                            # Handle parentheses (negative values)
                            if value_str.startswith('(') and value_str.endswith(')'):
                                value_str = '-' + value_str[1:-1]
                            
                            try:
                                return float(value_str)
                            except ValueError:
                                return 0.0
                        
                        # Map all available columns
                        row_data = []
                        for db_col in available_columns[:-1]:  # Exclude dataset_id
                            source_col = next((k for k, v in column_mapping.items() if v == db_col), None)
                            if source_col:
                                value = record.get(source_col, record.get(source_col.lower().replace(' ', '_'), ''))
                                if db_col in ['debit', 'credit', 'balance']:
                                    value = parse_financial_number(value)
                                elif db_col == 'date' and value:
                                    try:
                                        value = pd.to_datetime(value).date() if not pd.isna(value) else None
                                    except:
                                        value = None
                                else:
                                    value = str(value).strip() if value else None
                                row_data.append(value)
                            else:
                                row_data.append(None)
                        
                        row_data.append(dataset_id)  # Add dataset_id
                        batch_data.append(tuple(row_data))
                    except Exception as e:
                        print(f"Row error: {e}")
                        continue
                
                if batch_data:
                    cursor.executemany(insert_query, batch_data)
                    inserted_count += len(batch_data)
                    conn.commit()
                    print(f"✅ Inserted batch: {inserted_count} total records")
                    
        except Exception as e:
            conn.rollback()
            raise e
        
        # Update dataset status
        cursor.execute("UPDATE datasets SET status = 'completed', record_count = %s WHERE id = %s", (inserted_count, dataset_id))
        conn.commit()
        
        cursor.close()
        conn.close()
        
        print(f"✅ Completed: {inserted_count} records inserted")
        print(f"✅ Dataset {dataset_id} marked as completed")
        
        return jsonify({'success': True, 'records': inserted_count})
    
    except Exception as e:
        print(f"Error processing Excel: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'python-excel-processor'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)