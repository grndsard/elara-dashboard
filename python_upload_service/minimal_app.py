from flask import Flask, request, jsonify
import pandas as pd
import mysql.connector
import os
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app)

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'elara_db'),
        autocommit=False
    )

@app.route('/process-excel', methods=['POST'])
def process_excel():
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        dataset_id = data.get('dataset_id')
        selected_sheet = data.get('selected_sheet')
        
        print(f"🚀 Processing: {file_path}")
        print(f"📊 Dataset ID: {dataset_id}")
        
        # Read file based on extension
        if file_path.lower().endswith('.csv'):
            print("📄 Reading CSV file...")
            df = pd.read_csv(file_path, dtype=str, na_filter=False)
        else:
            print("📈 Reading Excel file...")
            df = pd.read_excel(file_path, sheet_name=selected_sheet, dtype=str, na_filter=False)
        
        print(f"✅ Loaded {len(df)} rows, {len(df.columns)} columns")
        print(f"📋 Columns: {list(df.columns)}")
        
        if len(df) == 0:
            return jsonify({'success': False, 'error': 'No data found in file'}), 400
        
        # Connect to database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Start transaction
        cursor.execute("START TRANSACTION")
        
        # Prepare insert query with essential columns only
        insert_query = """
            INSERT INTO dataset_records (
                company_code, company_display_name, account_group_name, 
                balance, debit, credit, date, dataset_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        inserted_count = 0
        error_count = 0
        
        print("💾 Starting database insertion...")
        
        # Process in batches
        batch_size = 1000
        for i in range(0, len(df), batch_size):
            batch = df.iloc[i:i + batch_size]
            batch_data = []
            
            for _, row in batch.iterrows():
                try:
                    # Extract and clean data
                    company_code = str(row.get('Company Code', row.get('company_code', ''))).strip()
                    company_display_name = str(row.get('Company Display Name', row.get('company_display_name', ''))).strip()
                    account_group_name = str(row.get('Account Group Name', row.get('account_group_name', ''))).strip()
                    
                    # Handle numeric fields
                    balance = 0
                    debit = 0
                    credit = 0
                    
                    try:
                        balance_str = str(row.get('Balance', row.get('balance', '0'))).replace(',', '').replace('"', '').strip()
                        if balance_str and balance_str != '':
                            balance = float(balance_str)
                    except:
                        balance = 0
                    
                    try:
                        debit_str = str(row.get('Debit', row.get('debit', '0'))).replace(',', '').replace('"', '').strip()
                        if debit_str and debit_str != '':
                            debit = float(debit_str)
                    except:
                        debit = 0
                    
                    try:
                        credit_str = str(row.get('Credit', row.get('credit', '0'))).replace(',', '').replace('"', '').strip()
                        if credit_str and credit_str != '':
                            credit = float(credit_str)
                    except:
                        credit = 0
                    
                    # Handle date
                    date_val = str(row.get('Date', row.get('date', ''))).strip()
                    if not date_val or date_val == '':
                        date_val = None
                    
                    # Only insert if we have some meaningful data
                    if company_code or account_group_name or balance != 0 or debit != 0 or credit != 0:
                        batch_data.append((
                            company_code,
                            company_display_name,
                            account_group_name,
                            balance,
                            debit,
                            credit,
                            date_val,
                            dataset_id
                        ))
                    
                except Exception as row_error:
                    print(f"⚠️  Row error: {row_error}")
                    error_count += 1
                    continue
            
            # Insert batch
            if batch_data:
                try:
                    cursor.executemany(insert_query, batch_data)
                    inserted_count += len(batch_data)
                    print(f"✅ Inserted batch {i//batch_size + 1}: {len(batch_data)} records (Total: {inserted_count})")
                except Exception as batch_error:
                    print(f"❌ Batch insert error: {batch_error}")
                    conn.rollback()
                    cursor.close()
                    conn.close()
                    return jsonify({'success': False, 'error': f'Database error: {batch_error}'}), 500
        
        # Update dataset status
        cursor.execute(
            "UPDATE datasets SET status = 'completed', record_count = %s WHERE id = %s",
            (inserted_count, dataset_id)
        )
        
        # Commit transaction
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"🎉 SUCCESS: {inserted_count} records inserted, {error_count} errors")
        print(f"✅ Dataset {dataset_id} marked as completed")
        
        return jsonify({
            'success': True, 
            'records': inserted_count,
            'errors': error_count
        })
        
    except Exception as e:
        print(f"❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    try:
        # Test database connection
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        
        return jsonify({
            'status': 'healthy',
            'service': 'minimal-python-processor',
            'database': 'connected'
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'minimal-python-processor',
            'database': 'disconnected',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("🐍 Starting Minimal Python Upload Service...")
    print("📊 Service: http://localhost:5000")
    print("🔍 Health: http://localhost:5000/health")
    app.run(debug=True, port=5000, host='0.0.0.0')