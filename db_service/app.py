from flask import Flask, request, jsonify
import mysql.connector
from mysql.connector import pooling
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
    'pool_name': 'elara_db_pool',
    'pool_size': 15
}

try:
    connection_pool = pooling.MySQLConnectionPool(**DB_CONFIG)
    print("✅ Database connection pool created")
except Exception as e:
    print(f"❌ Pool creation failed: {e}")
    connection_pool = None

@app.route('/insert-batch', methods=['POST'])
def insert_batch():
    try:
        data = request.get_json()
        records = data.get('records', [])
        
        if not records:
            return jsonify({'success': False, 'error': 'No records'}), 400
        
        conn = connection_pool.get_connection()
        cursor = conn.cursor(buffered=True)
        
        cursor.execute("SET autocommit = 0")
        cursor.execute("SET foreign_key_checks = 0")
        
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
        
        batch_size = 10000
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            cursor.executemany(insert_query, batch)
        
        conn.commit()
        cursor.execute("SET foreign_key_checks = 1")
        cursor.close()
        conn.close()
        
        return jsonify({'success': True, 'inserted': len(records)})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'database-insertion-service'})

if __name__ == '__main__':
    app.run(debug=True, port=5001)