'use strict';

module.exports = {
    Metrics: {
        Labels: {
            Target: 'target',
            Method: 'method',
            StatusCode: 'status_code'
        },
        DefaultValues: {
            Method: 'GET'
        },
        HistogramValues: {
            Buckets: [0.1, 0.3, 1.5, 5, 10, 15, 20, 30]
        }
    },
    MaxRetries: 5,
    WarnAfterSeconds: 5
};
