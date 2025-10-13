import sys
import json
import pandas as pd
import mysql.connector
from datetime import datetime

def process_excel(file_path, dataset_id):
    try:
        df = pd.read_excel(file_path)
        
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='elara_db'
        )
        cursor = conn.cursor()
        
        records = []
        for _, row in df.iterrows():
            record = (
                row.get('Company Code'), row.get('Company Display Name'), row.get('Location Display Name'),
                row.get('Location Area Code'), row.get('Location Parent Code'), row.get('Label'),
                row.get('Partner Display Name'), row.get('Unit Department Name'), row.get('Business Display Name'),
                row.get('Account Group Name'), row.get('Account Code'), row.get('Account Name'),
                row.get('Product Display Name'), pd.to_datetime(row.get('Date')).date() if pd.notna(row.get('Date')) else None,
                float(row.get('Debit', 0)), float(row.get('Credit', 0)), float(row.get('Balance', 0)),
                row.get('Journal Type'), row.get('Journal Entry Number'), row.get('Invoice Number'),
                row.get('ID Project Display Name'), row.get('Reference'), row.get('Type Display Name'),
                row.get('Month'), row.get('Company2'), row.get('Regional'), row.get('Ref'),
                row.get('Divisi'), row.get('Grouping Bisnis'), row.get('Akun Utama'),
                row.get('Figure Utama'), row.get('Akun Group 1'), row.get('Akun Group 2 Type'),
                row.get('Figure Actual'), row.get('Cek Holding'), dataset_id
            )
            records.append(record)
        
        cursor.executemany("""
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
        """, records)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {'success': True, 'records': len(records)}
    
    except Exception as e:
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    file_path = sys.argv[1]
    dataset_id = int(sys.argv[2])
    result = process_excel(file_path, dataset_id)
    print(json.dumps(result))