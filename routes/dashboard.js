const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get filters only (fast endpoint for initial load)
router.get('/filters', authenticateToken, async (req, res) => {
  try {
    // Get available datasets for filter
    const [datasets] = await db.execute(
      'SELECT id, name FROM datasets WHERE status = "completed" ORDER BY name'
    );
    
    res.json({
      success: true,
      data: {
        datasets: datasets.map(dataset => ({
          id: dataset.id,
          name: dataset.name
        }))
      }
    });
  } catch (error) {
    console.error('Dashboard filters error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch filters' });
  }
});

// Get dashboard data
router.get('/data', authenticateToken, async (req, res) => {
  try {
    const { dataset, entity, region, month } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (dataset && dataset !== 'all') {
      whereConditions.push('dataset_id = ?');
      params.push(dataset);
    }
    
    if (entity && entity !== 'all') {
      whereConditions.push('company_code = ?');
      params.push(entity);
    }
    
    if (region && region !== 'all') {
      whereConditions.push('location_parent_code = ?');
      params.push(region);
    }
    
    if (month && month !== 'all') {
      whereConditions.push('month = ?');
      params.push(month);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Single query to get all totals at once for better performance
    const [totalsResult] = await db.execute(
      `SELECT 
        COALESCE(SUM(CASE WHEN account_group_name = 'REVENUE' THEN balance ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN account_group_name = 'COGS' THEN balance ELSE 0 END), 0) as total_cogs_amount,
        COALESCE(SUM(CASE WHEN account_group_name = 'OPERATING EXPENSE' THEN balance ELSE 0 END), 0) as total_opex,
        COALESCE(SUM(CASE WHEN account_name = 'Interest Expenses - ROU' THEN balance ELSE 0 END), 0) as total_interest,
        COALESCE(SUM(CASE WHEN account_group_name = 'DEPRECIATION & AMORTIZATION' THEN balance ELSE 0 END), 0) as total_depreciation,
        COALESCE(SUM(CASE WHEN account_group_name = 'OTHER EXPENSE (INCOME)' THEN balance ELSE 0 END), 0) as total_other_income,
        COALESCE(SUM(CASE WHEN account_group_name = 'TAX EXPENSE' THEN balance ELSE 0 END), 0) as total_tax
       FROM dataset_records 
       ${whereClause}`,
      params
    );
    
    // Calculate values according to business logic
    const totalRevenue = parseFloat(totalsResult[0].total_revenue);
    const totalCogsAmount = parseFloat(totalsResult[0].total_cogs_amount);
    const totalOpex = parseFloat(totalsResult[0].total_opex);
    const totalInterest = parseFloat(totalsResult[0].total_interest);
    const totalDepreciation = parseFloat(totalsResult[0].total_depreciation);
    const totalOtherIncome = parseFloat(totalsResult[0].total_other_income);
    const totalTax = parseFloat(totalsResult[0].total_tax);
    
    // Console Gross Profit = Console Revenue - COGS (if COGS is negative, add it to revenue)
    const totalCogs = totalCogsAmount < 0 ? totalRevenue + totalCogsAmount : totalRevenue - totalCogsAmount;
    
    // EBITDA = Console Gross Profit - Operating Expense - Interest RoU
    const totalEbitda = totalCogs - totalOpex - totalInterest;
    
    // Console Net Income = Console Revenue +/- COGS - Operating Expense - Depreciation & Amortization - Other Income (Expense) - Tax Expense
    const totalNettIncome = totalCogsAmount < 0 
      ? totalRevenue + totalCogsAmount - totalOpex - totalDepreciation - totalOtherIncome - totalTax
      : totalRevenue - totalCogsAmount - totalOpex - totalDepreciation - totalOtherIncome - totalTax;

    // Revenue per Entity (sum of balance where account_group_name = 'Revenue')
    const [revenueByEntity] = await db.execute(
      `SELECT 
        company_code,
        company_display_name,
        ABS(COALESCE(SUM(balance), 0)) as revenue
      FROM dataset_records 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'REVENUE'
      GROUP BY company_code, company_display_name
      HAVING ABS(SUM(balance)) > 0
      ORDER BY revenue DESC`,
      params
    );

    // Gross Profit per Entity (Revenue +/- COGS per entity based on COGS sign)
    const [cogsByEntity] = await db.execute(
      `SELECT 
        r.company_code,
        r.company_display_name,
        CASE 
          WHEN COALESCE(c.cogs, 0) < 0 THEN COALESCE(r.revenue, 0) + COALESCE(c.cogs, 0)
          ELSE COALESCE(r.revenue, 0) - COALESCE(c.cogs, 0)
        END as cogs
      FROM (
        SELECT company_code, company_display_name, SUM(balance) as revenue
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'REVENUE'
        GROUP BY company_code, company_display_name
      ) r
      LEFT JOIN (
        SELECT company_code, SUM(balance) as cogs
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'COGS'
        GROUP BY company_code
      ) c ON r.company_code = c.company_code
      ORDER BY cogs DESC`,
      [...params, ...params]
    );
    
    // EBITDA per Entity (Gross Profit - Operating Expense - Interest RoU per entity)
    const [ebitdaByEntity] = await db.execute(
      `SELECT 
        r.company_code,
        r.company_display_name,
        CASE 
          WHEN COALESCE(c.cogs, 0) < 0 THEN (COALESCE(r.revenue, 0) + COALESCE(c.cogs, 0) - COALESCE(o.opex, 0) - COALESCE(i.interest, 0))
          ELSE (COALESCE(r.revenue, 0) - COALESCE(c.cogs, 0) - COALESCE(o.opex, 0) - COALESCE(i.interest, 0))
        END as ebitda
      FROM (
        SELECT company_code, company_display_name, SUM(balance) as revenue
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'REVENUE'
        GROUP BY company_code, company_display_name
      ) r
      LEFT JOIN (
        SELECT company_code, SUM(balance) as cogs
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'COGS'
        GROUP BY company_code
      ) c ON r.company_code = c.company_code
      LEFT JOIN (
        SELECT company_code, SUM(balance) as opex
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'OPERATING EXPENSE'
        GROUP BY company_code
      ) o ON r.company_code = o.company_code
      LEFT JOIN (
        SELECT company_code, SUM(balance) as interest
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_name = 'INTEREST EXPENSES - ROU'
        GROUP BY company_code
      ) i ON r.company_code = i.company_code
      ORDER BY ebitda DESC`,
      [...params, ...params, ...params, ...params]
    );
    
    // Net Income per Entity (Revenue +/- COGS - Operating Expense - Depreciation - Other Income - Tax per entity)
    const [nettIncomeByEntity] = await db.execute(
      `SELECT 
        r.company_code,
        r.company_display_name,
        CASE 
          WHEN COALESCE(c.cogs, 0) < 0 THEN (COALESCE(r.revenue, 0) + COALESCE(c.cogs, 0) - COALESCE(o.opex, 0) - COALESCE(d.depreciation, 0) - COALESCE(oi.other_income, 0) - COALESCE(t.tax, 0))
          ELSE (COALESCE(r.revenue, 0) - COALESCE(c.cogs, 0) - COALESCE(o.opex, 0) - COALESCE(d.depreciation, 0) - COALESCE(oi.other_income, 0) - COALESCE(t.tax, 0))
        END as nett_income
      FROM (
        SELECT company_code, company_display_name, SUM(balance) as revenue
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'REVENUE'
        GROUP BY company_code, company_display_name
      ) r
      LEFT JOIN (
        SELECT company_code, SUM(balance) as cogs
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'COGS'
        GROUP BY company_code
      ) c ON r.company_code = c.company_code
      LEFT JOIN (
        SELECT company_code, SUM(balance) as opex
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'OPERATING EXPENSE'
        GROUP BY company_code
      ) o ON r.company_code = o.company_code
      LEFT JOIN (
        SELECT company_code, SUM(balance) as depreciation
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'DEPRECIATION & AMORTIZATION'
        GROUP BY company_code
      ) d ON r.company_code = d.company_code
      LEFT JOIN (
        SELECT company_code, SUM(balance) as other_income
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'OTHER INCOME (EXPENSE)'
        GROUP BY company_code
      ) oi ON r.company_code = oi.company_code
      LEFT JOIN (
        SELECT company_code, SUM(balance) as tax
        FROM dataset_records 
        ${whereClause ? whereClause + ' AND' : 'WHERE'} account_group_name = 'TAX EXPENSE'
        GROUP BY company_code
      ) t ON r.company_code = t.company_code
      ORDER BY nett_income DESC`,
      [...params, ...params, ...params, ...params, ...params, ...params]
    );

    // Get available datasets for filter
    const [datasets] = await db.execute(
      'SELECT id, name FROM datasets WHERE status = "completed" ORDER BY name'
    );
    
    // Get available entities for filter from dataset_records
    const [entities] = await db.execute(
      'SELECT DISTINCT company_code, company_display_name FROM dataset_records WHERE company_code IS NOT NULL ORDER BY company_display_name'
    );
    
    // Get available regions for filter from dataset_records
    const [regions] = await db.execute(
      'SELECT DISTINCT location_parent_code FROM dataset_records WHERE location_parent_code IS NOT NULL ORDER BY location_parent_code'
    );
    
    // Get available months for filter from dataset_records
    const [months] = await db.execute(
      `SELECT DISTINCT month FROM dataset_records 
       WHERE month IS NOT NULL 
       ORDER BY FIELD(month, 'January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December')`
    );

    // Calculate performance metrics
    const profitMargin = totalRevenue > 0 ? ((totalCogs / totalRevenue) * 100).toFixed(1) : '0.0';
    const ebitdaMargin = totalRevenue > 0 ? ((totalEbitda / totalRevenue) * 100).toFixed(1) : '0.0';
    const topPerformer = revenueByEntity.length > 0 ? revenueByEntity[0].company_display_name || revenueByEntity[0].company_code : '-';
    const lowPerformer = revenueByEntity.length > 0 ? revenueByEntity[revenueByEntity.length - 1].company_display_name || revenueByEntity[revenueByEntity.length - 1].company_code : '-';
    const activeEntities = entities.length;
    
    console.log('Performance Metrics:', {
      totalRevenue, totalCogs, totalEbitda,
      profitMargin, ebitdaMargin, topPerformer, activeEntities
    });

    res.json({
      success: true,
      data: {
        cards: {
          totalRevenue,
          totalCogs,
          totalEbitda,
          totalNettIncome
        },
        performance: {
          profitMargin,
          ebitdaMargin,
          topPerformer,
          lowPerformer
        },
        charts: {
          revenueByEntity: revenueByEntity.map(item => ({
            name: item.company_code,
            value: parseFloat(item.revenue)
          })),
          cogsByEntity: cogsByEntity.map(item => ({
            name: item.company_code,
            value: parseFloat(item.cogs)
          })),
          ebitdaByEntity: ebitdaByEntity.map(item => ({
            name: item.company_code,
            value: parseFloat(item.ebitda)
          })),
          nettIncomeByEntity: nettIncomeByEntity.map(item => ({
            name: item.company_code,
            value: parseFloat(item.nett_income)
          }))
        },
        filters: {
          datasets: datasets.map(dataset => ({
            id: dataset.id,
            name: dataset.name
          })),
          entities: entities.map(entity => ({
            id: entity.company_code,
            name: entity.company_display_name || entity.company_code,
            code: entity.company_code
          })),
          regions: regions.map(region => ({
            id: region.location_parent_code,
            name: region.location_parent_code
          })),
          months: months.map(month => ({
            id: month.month,
            name: month.month
          }))
        }
      }
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;