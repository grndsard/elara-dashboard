# Python Excel Upload Service

Minimal Python service for uploading Excel files to dataset_records table.

## Setup

```bash
pip install -r requirements.txt
```

## Configuration

Update DB_CONFIG in app.py:
```python
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'your_password',
    'database': 'elara_db'
}
```

## Run

```bash
python app.py
```

## Usage

POST to http://localhost:5000/upload with Excel file in 'file' field.

Expected Excel columns match dataset_records table structure.