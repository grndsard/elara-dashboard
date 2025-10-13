const { QBusinessClient, ChatSyncCommand, GetApplicationCommand } = require('@aws-sdk/client-qbusiness');
const db = require('../config/database');

class QBusinessService {
  constructor() {
    this.client = new QBusinessClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    this.applicationId = process.env.Q_BUSINESS_APPLICATION_ID;
  }

  async isConfigured() {
    return !!(
      process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.Q_BUSINESS_APPLICATION_ID
    );
  }

  async testConnection() {
    try {
      if (!await this.isConfigured()) {
        return { success: false, message: 'Q Business not configured' };
      }

      const command = new GetApplicationCommand({
        applicationId: this.applicationId
      });
      
      await this.client.send(command);
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async query(userQuery, userId, conversationId = null) {
    try {
      if (!await this.isConfigured()) {
        throw new Error('Amazon Q Business is not configured');
      }

      // Enhance query with financial context
      const enhancedQuery = await this.enhanceQueryWithContext(userQuery);

      const command = new ChatSyncCommand({
        applicationId: this.applicationId,
        userMessage: enhancedQuery,
        userId: userId.toString(),
        conversationId: conversationId,
        userGroups: ['finance-users'],
        attributeFilter: {
          andAllFilters: [
            {
              equalsTo: {
                name: 'source_type',
                value: { stringValue: 'financial_data' }
              }
            }
          ]
        }
      });

      const response = await this.client.send(command);
      
      return {
        success: true,
        data: {
          answer: response.systemMessage,
          conversationId: response.conversationId,
          sources: response.sourceAttributions?.map(source => ({
            title: source.title,
            url: source.url,
            snippet: source.snippet
          })) || []
        }
      };
    } catch (error) {
      console.error('Q Business query error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async enhanceQueryWithContext(userQuery) {
    try {
      // Get available entities and account groups for context
      const [entities] = await db.execute(
        'SELECT DISTINCT company_display_name FROM dataset_records WHERE company_display_name IS NOT NULL LIMIT 10'
      );
      
      const [accountGroups] = await db.execute(
        'SELECT DISTINCT account_group_name FROM dataset_records WHERE account_group_name IS NOT NULL LIMIT 10'
      );

      const entityNames = entities.map(e => e.company_display_name).join(', ');
      const accountGroupNames = accountGroups.map(a => a.account_group_name).join(', ');

      const context = `
Context: This query is about financial data from Elara system.
Available entities: ${entityNames}
Available account groups: ${accountGroupNames}
Financial metrics available: Revenue, COGS, Gross Profit, EBITDA, Net Income, Operating Expenses

User Query: ${userQuery}
`;

      return context;
    } catch (error) {
      console.error('Error enhancing query:', error);
      return userQuery;
    }
  }

  async syncDataToQBusiness() {
    // This would sync your dataset to Q Business data source
    // Implementation depends on your Q Business data source configuration
    console.log('Data sync to Q Business would be implemented here');
    return { success: true, message: 'Data sync initiated' };
  }
}

module.exports = new QBusinessService();