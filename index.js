'use strict';

const fetch = require('node-fetch');
const constants = require('./constants');

let external_http_request_duration_seconds_histogram = null;

const _fetch = async (url, options, retries = 1) => {
    try {
        return await fetch(url, options);
    } catch (err) {
        if (retries < constants.MaxRetries) {
            return _fetch(url, options, retries + 1);
        } else {
            throw err;
        }
    }
};

class Fetcher {
    constructor(logger) {
        this.logger = logger;
    }

    async fetch(url, options) {
        let timer;
        let currentRequestLabels;
        const shouldTraceRequest = (!options || !options.skipTraceRequest) && external_http_request_duration_seconds_histogram;
        if (shouldTraceRequest) {
            currentRequestLabels = {
                [constants.Metrics.Labels.Target]: new URL(url).host,
                [constants.Metrics.Labels.Method]: options && options.method || constants.Metrics.DefaultValues.Method
            };

            timer = external_http_request_duration_seconds_histogram.startTimer(currentRequestLabels);
        }

        const startTime = process.hrtime();

        try {
            const response = await _fetch(url, options);
            const endTime = process.hrtime(startTime);
            if (shouldTraceRequest) {
                currentRequestLabels[constants.Metrics.Labels.StatusCode] = response.status;
                timer();
            }

            if (endTime[0] >= constants.WarnAfterSeconds) {
                this.logger.warn(`Request to ${url} took ${endTime[0]} seconds to execute.`);
            }

            // Always drain the response body to avoid memory leaks.
            // https://github.com/bitinn/node-fetch/issues/83
            // https://github.com/bitinn/node-fetch/issues/420
            const buffer = await response.buffer();
            response.text = async () => buffer.toString();
            response.json = async () => JSON.parse(buffer.toString());
            response.buffer = async () => buffer;

            return response;
        } catch (error) {
            const endTime = process.hrtime(startTime);
            this.logger.error(`Failed request for ${url} with "${error.message}" after ${endTime[0]} seconds`);
            throw error;
        }
    }
}

module.exports = {
    collectDefaultMetrics: (promClient) => {
        const external_http_request_duration_seconds_labels = [constants.Metrics.Labels.Target, constants.Metrics.Labels.Method, constants.Metrics.Labels.StatusCode];
        external_http_request_duration_seconds_histogram = new promClient.Histogram({
            name: 'external_http_request_duration_seconds',
            help: `duration histogram of http responses labeled with: ${external_http_request_duration_seconds_labels.join(', ')}`,
            labelNames: external_http_request_duration_seconds_labels,
            buckets: constants.Metrics.HistogramValues.Buckets
        });
    },
    fetcherFactory: (logger) => {
        return new Fetcher(logger);
    }
};
