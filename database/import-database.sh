#!/bin/bash

echo "========================================"
echo " Elara Database Import Script"
echo "========================================"
echo

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

echo "Importing Elara database..."
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USER"
echo

# Import database
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD < database/elara_db_import.sql

if [ $? -eq 0 ]; then
    echo
    echo "✅ Database imported successfully!"
    echo
    echo "Default login credentials:"
    echo "Email: admin@elara.com"
    echo "Password: Admin123!"
    echo
    echo "User account:"
    echo "Email: user@elara.com"
    echo "Password: User123!"
    echo
else
    echo
    echo "❌ Database import failed!"
    echo "Please check your MySQL connection and credentials."
    echo
fi