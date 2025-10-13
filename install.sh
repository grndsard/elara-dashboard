#!/bin/bash

echo "========================================"
echo "Elara (Enriched Kisel Analytics for Real-time Access)) Installation"
echo "========================================"
echo

echo "Installing dependencies..."
npm install

echo
echo "Setting up database..."
npm run migrate

echo
echo "Inserting seed data..."
npm run seed

echo
echo "========================================"
echo "Installation completed successfully!"
echo "========================================"
echo
echo "Default admin credentials:"
echo "Email: admin@elara.com"
echo "Password: Admin123!"
echo
echo "To start the application:"
echo "npm run dev (development)"
echo "npm start (production)"
echo
echo "Access the application at: http://localhost:3000"
echo