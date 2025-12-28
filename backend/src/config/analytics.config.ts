export const analyticsConfig = {
    priceHistory: {
        defaultDays: parseInt(process.env.ANALYTICS_DEFAULT_DAYS || '30'),
        maxDays: parseInt(process.env.ANALYTICS_MAX_DAYS || '365'),
        minDays: 7,
        allowedPeriods: [7, 14, 30, 60, 90, 180, 365]
    },
    charts: {
        maxDataPoints: 100,
        cacheTimeout: parseInt(process.env.ANALYTICS_CACHE_TTL || '300')
    },
    autoGrouping: {
        dayThreshold: 90,
        weekThreshold: 180
    }
};
