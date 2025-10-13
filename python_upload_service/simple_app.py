from flask import Flask, request, jsonify
import pandas as pd
import mysql.connector
import os
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route('/process-excel', methods=['POST'])
def process_excel():
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        dataset_id = data.get('dataset_id')
        selected_sheet = data.get('selected_sheet')
        
        print(f"Processing: {file_path}")
        
        # Read file
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path, dtype=str)
        else:
            df = pd.read_excel(file_path, sheet_name=selected_sheet, dtype=str)
        
        df = df.fillna('')
        print(f"Loaded {len(df)} records")
        
        # Connect to database
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'elara_db')
        )
        cursor = conn.cursor()
        
        # Simple insert query
        query = """INSERT INTO dataset_records (
            company_code, account_group_name, balance, debit, credit, dataset_id
        ) VALUES (%s, %s, %s, %s, %s, %s)"""
        
        # Process records one by one
        inserted = 0
        for _, row in df.iterrows():
            try:
                values = (
                    str(row.get('Company Code', '')),
                    str(row.get('Account Group Name', '')),
                    float(row.get('Balance', 0)) if row.get('Balance') else 0,
                    float(row.get('Debit', 0)) if row.get('Debit') else 0,
                    float(row.get('Credit', 0)) if row.get('Credit') else 0,
                    dataset_id
                )
                cursor.execute(query, values)
                inserted += 1
                
                if inserted % 1000 == 0:
                    conn.commit()
                    print(f"Inserted {inserted} records")
                    
            except Exception as e:
                print(f"Row error: {e}")
                continue
        
        # Update dataset status to completed
        cursor.execute("UPDATE datasets SET status = 'completed', record_count = %s WHERE id = %s", (inserted, dataset_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Completed: {inserted} records")
        print(f"✅ Dataset {dataset_id} marked as completed")
        return jsonify({'success': True, 'records': inserted})
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)