# Amazon Q Business Setup Guide for Elara

## Prerequisites
1. AWS Account with appropriate permissions
2. Amazon Q Business application created
3. IAM user with Q Business permissions

## Step 1: Create Amazon Q Business Application

### 1.1 AWS Console Setup
1. Go to AWS Console → Amazon Q Business
2. Click "Create application"
3. Choose application name: `elara-financial-analytics`
4. Select service access role or create new one
5. Configure identity provider (IAM Identity Center recommended)

### 1.2 Create Data Source
1. In your Q Business application, go to "Data sources"
2. Click "Add data source"
3. Choose "Database" connector
4. Configure MySQL connection:
   ```
   Host: localhost (or your DB host)
   Port: 3306
   Database: elara_db
   Username: [your-db-user]
   Password: [your-db-password]
   ```

### 1.3 Configure Index
1. Create index for financial data
2. Map database tables:
   - `dataset_records` (main financial data)
   - `datasets` (metadata)
   - `users` (user context)

## Step 2: Configure Environment Variables

Update your `.env` file:

```env
# Amazon Q Business Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
Q_BUSINESS_APPLICATION_ID=your_app_id_here
Q_BUSINESS_EMBED_URL=https://your-qbusiness-domain.amazonaws.com/embed
Q_BUSINESS_USER_ID=your_user_id
Q_BUSINESS_INDEX_ID=your_index_id
```

## Step 3: IAM Permissions

Create IAM policy for Q Business access:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "qbusiness:ChatSync",
                "qbusiness:GetApplication",
                "qbusiness:ListConversations",
                "qbusiness:GetRetriever",
                "qbusiness:ListDataSources"
            ],
            "Resource": [
                "arn:aws:qbusiness:*:*:application/your-app-id",
                "arn:aws:qbusiness:*:*:application/your-app-id/*"
            ]
        }
    ]
}
```

## Step 4: Install Dependencies

```bash
npm install @aws-sdk/client-qbusiness
```

## Step 5: Data Source Configuration

### 5.1 Database Schema Mapping
Map your database fields to Q Business attributes:

```sql
-- Main financial data table
dataset_records:
- company_display_name → entity_name
- account_name → account
- account_group_name → category  
- balance → amount
- month → period
- debit_amount → debit
- credit_amount → credit

-- Metadata
datasets:
- name → dataset_name
- upload_time → created_date
```

### 5.2 Sync Data
Run the data sync endpoint:
```bash
POST /api/qbusiness/sync-data
```

## Step 6: Test Integration

### 6.1 Check Status
```bash
GET /api/qbusiness/status
```

### 6.2 Test Query
```bash
POST /api/qbusiness/query
{
  "query": "What is our total revenue this month?"
}
```

## Step 7: Troubleshooting

### Common Issues:

1. **Authentication Error**
   - Verify AWS credentials
   - Check IAM permissions
   - Ensure Q Business application exists

2. **Data Source Connection Failed**
   - Verify database connectivity
   - Check VPC/security group settings
   - Validate database credentials

3. **No Results from Queries**
   - Ensure data source is synced
   - Check index configuration
   - Verify data mapping

### Debug Commands:
```bash
# Test AWS credentials
aws sts get-caller-identity

# Test Q Business application
aws qbusiness get-application --application-id your-app-id

# Check data source status
aws qbusiness list-data-sources --application-id your-app-id
```

## Step 8: Production Considerations

1. **Security**
   - Use IAM roles instead of access keys in production
   - Enable CloudTrail logging
   - Configure VPC endpoints for private connectivity

2. **Performance**
   - Set up data source sync schedule
   - Monitor query performance
   - Configure appropriate index settings

3. **Monitoring**
   - Set up CloudWatch metrics
   - Configure alerts for failed syncs
   - Monitor API usage and costs

## Sample Queries for Testing

Once configured, test with these financial queries:

1. "What is our total revenue for this quarter?"
2. "Show me COGS breakdown by entity"
3. "Which company has the highest gross profit?"
4. "Compare revenue trends over the last 6 months"
5. "What are our operating expenses by category?"

## Next Steps

1. Configure data source sync schedule
2. Set up user groups and permissions
3. Create custom prompts for financial analysis
4. Integrate with existing reporting workflows