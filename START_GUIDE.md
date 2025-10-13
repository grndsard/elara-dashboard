# 🚀 Elara Startup Guide

## ✅ Prerequisites Verified
- ✅ Node.js dependencies installed
- ✅ Python dependencies installed  
- ✅ Database created and migrated
- ✅ Seed data inserted
- ✅ Upload functionality tested

## 🎯 Quick Start (3 Steps)

### Step 1: Start Python Services
Open **3 separate command prompts** in your Elara directory:

**Terminal 1 - Database Service:**
```bash
cd db_service
python app.py
```

**Terminal 2 - Python Upload Service:**
```bash
cd python_upload_service  
python app.py
```

**Terminal 3 - Main Elara Server:**
```bash
npm start
```

### Step 2: Access Elara
Open your browser and go to: **http://localhost:3000**

### Step 3: Login
- **Email:** admin@elara.com
- **Password:** Admin123!

## 🔧 Service Status Check

### Verify All Services Running:
- **Main Dashboard:** http://localhost:3000 ✅
- **Python Upload Service:** http://localhost:5000/health ✅  
- **Database Service:** http://localhost:5001/health ✅

## 📊 Upload Test

1. **Login** to Elara dashboard
2. **Go to Master Data → Dataset**
3. **Click Upload Dataset** (+ button)
4. **Upload the provided CSV_Template.csv**
5. **Check dashboard** for new data

## 🛠 Troubleshooting

### Upload Fails?
1. **Check Python services** are running (ports 5000 & 5001)
2. **Check database connection** in .env file
3. **Check file format** matches CSV_Template.csv
4. **Check console logs** for specific errors

### Database Issues?
```bash
# Test database connection
node test-upload.js
```

### Service Issues?
```bash
# Check if ports are in use
netstat -an | findstr :3000
netstat -an | findstr :5000  
netstat -an | findstr :5001
```

## 🎉 Success Indicators

✅ **All 3 services running** without errors
✅ **Dashboard loads** with login page
✅ **Login successful** with admin credentials  
✅ **File upload works** and data appears in dashboard
✅ **Charts display** financial data correctly

## 📈 Next Steps

1. **Upload your financial data** using the CSV template
2. **Explore dashboard** metrics and charts
3. **Try Amazon Q Business** for AI queries
4. **Add users** via User Management
5. **Check audit trail** for activity logs

---

**🎯 Your Elara dashboard is ready for production use!**