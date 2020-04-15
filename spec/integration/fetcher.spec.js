'use strict';

const client = require('prom-client');
const { EOL } = require('os');
const { startServer } = require('../helpers/helpers');

const { TestServer } = require('../constants');

const { collectDefaultMetrics, fetcherFactory } = require('../../index');

const ExpectedMetricComments = [
    '# HELP external_http_request_duration_seconds duration histogram of http responses labeled with: target, method, status_code, error',
    '# TYPE external_http_request_duration_seconds histogram'
].map(m => `${m}${EOL}`).join('');

const getExpectedMetrics = ({ showError, skipComments } = {}) => {
    const endString = showError ? ',error="FetchError"' : ',status_code="200"';
    const beginString = skipComments ? '' : ExpectedMetricComments;
    return beginString + [
        `external_http_request_duration_seconds_bucket{le="0.1",target="localhost:3333",method="GET"${endString}} 1`,
        `external_http_request_duration_seconds_bucket{le="0.3",target="localhost:3333",method="GET"${endString}} 1`,
        `external_http_request_duration_seconds_bucket{le="1.5",target="localhost:3333",method="GET"${endString}} 1`,
        `external_http_request_duration_seconds_bucket{le="5",target="localhost:3333",method="GET"${endString}} 1`,
        `external_http_request_duration_seconds_bucket{le="10",target="localhost:3333",method="GET"${endString}} 1`,
        `external_http_request_duration_seconds_bucket{le="15",target="localhost:3333",method="GET"${endString}} 1`,
        `external_http_request_duration_seconds_bucket{le="20",target="localhost:3333",method="GET"${endString}} 1`,
        `external_http_request_duration_seconds_bucket{le="30",target="localhost:3333",method="GET"${endString}} 1`,
        `external_http_request_duration_seconds_bucket{le="+Inf",target="localhost:3333",method="GET"${endString}} 1`,
        `external_http_request_duration_seconds_sum{target="localhost:3333",method="GET"${endString}} `,
        `external_http_request_duration_seconds_count{target="localhost:3333",method="GET"${endString}} 1`
    ].map(m => `${m}${EOL}`).join('');
};

const getMetricsWithoutSumValue = (metrics) => metrics.replace(/\d[.]\d{3,}/g, '');

describe('Fetcher', () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 6000;
    let server;

    beforeEach(async () => {
        server = await startServer();
    });

    afterEach(() => {
        server.close();
    });

    describe('fetcherFactory', () => {
        it('should return fetcher instance.', () => {
            const fetcher = fetcherFactory({});
            expect(fetcher).toBeDefined();
            expect(fetcher.fetch).toBeDefined();
        });

        it('returned fetcher should be able to get text from url.', async () => {
            const fetcher = fetcherFactory({});
            const url = `${TestServer.BaseUrl}${TestServer.TextEndpointPath}`;
            const result = await fetcher.fetch(url);
            expect(result).toBeDefined();
            const resultText = await result.text();
            expect(resultText).toEqual(TestServer.TextEndpointResponseText);
        });

        it('returned fetcher should be able to get JSON from url.', async () => {
            const fetcher = fetcherFactory({});
            const url = `${TestServer.BaseUrl}${TestServer.JSONEndpointPath}`;
            const result = await fetcher.fetch(url);
            expect(result).toBeDefined();
            const resultText = await result.json();
            expect(resultText).toEqual(TestServer.JSONEndpointResponseObject);
        });

        it('returned fetcher should throw when fetching wrong url.', async () => {
            const fetcher = fetcherFactory({});
            await expectAsync(fetcher.fetch('https://wrongurl')).toBeRejected();
        });

        it('returned fetcher should issue warning upon a slow request.', async () => {
            let warnText = '';
            const fetcher = fetcherFactory({
                warn: (text) => warnText += text
            });
            const url = `${TestServer.BaseUrl}${TestServer.SlowEndpointPath}`;
            const result = await fetcher.fetch(url);
            expect(result).toBeDefined();
            const resultText = await result.text();
            expect(resultText).toEqual(TestServer.SlowEndpointResult);
            const executionDelaySeconds = Math.floor(TestServer.SlowEndpointDelayMilliseconds / 1000);
            expect(warnText).toEqual(`Request to ${url} took ${executionDelaySeconds} seconds to execute.`);
        });

        it('returned fetcher should issue error message and throw.', async () => {
            let errorText = '';
            const fetcher = fetcherFactory({
                error: (text) => errorText += text
            });
            const url = `${TestServer.BaseUrl}${TestServer.ErrorEndpointPath}`;
            await expectAsync(fetcher.fetch(url)).toBeRejected();
            expect(errorText).toEqual(`Failed request for ${url} with "request to ${url} failed, reason: socket hang up" after 0 seconds`);
        });

        it('returned fetcher should respect timeout and should not retry timeout requests.', async () => {
            const fetcher = fetcherFactory({error: () => {}});
            const url = `${TestServer.BaseUrl}${TestServer.SlowEndpointPath}`;
            const timeout = 1000;
            const startTime = Date.now();
            await expectAsync(fetcher.fetch(url, { timeout })).toBeRejectedWithError(`network timeout at: ${url}`);
            const endTime = Date.now();
            const elapsedTimeMilliseconds = endTime - startTime;
            expect(elapsedTimeMilliseconds).toBeGreaterThanOrEqual(timeout);
            expect(elapsedTimeMilliseconds).toBeLessThanOrEqual(timeout * 2);
        });
    });

    describe('collectDefaultMetrics', () => {
        afterEach(() => {
            client.register.clear();
        });

        it('should register metrics.', () => {
            collectDefaultMetrics(client);
            const metrics = client.register.metrics({ timestamps: false });
            expect(metrics).toEqual(ExpectedMetricComments);
        });

        it('should track metrics.', async () => {
            collectDefaultMetrics(client);
            const fetcher = fetcherFactory({});

            let url = `${TestServer.BaseUrl}${TestServer.TextEndpointPath}`;
            await fetcher.fetch(url);

            let metrics = client.register.metrics({ timestamps: false });
            let metricsWithoutSumValue = getMetricsWithoutSumValue(metrics);
            let expecedMetrics = getExpectedMetrics();
            expect(metricsWithoutSumValue).toEqual(expecedMetrics);

            url = `${TestServer.BaseUrl}${TestServer.ErrorEndpointPath}`;
            await expectAsync(fetcher.fetch(url)).toBeRejected();

            metrics = client.register.metrics({ timestamps: false });
            metricsWithoutSumValue = getMetricsWithoutSumValue(metrics);
            expecedMetrics += getExpectedMetrics({ showError: true, skipComments: true });
            expect(metricsWithoutSumValue).toEqual(expecedMetrics);
        });

        it('should not track when skipTrackRequest is passed.', async () => {
            collectDefaultMetrics(client);
            const fetcher = fetcherFactory({});
            const url = `${TestServer.BaseUrl}${TestServer.TextEndpointPath}`;
            await fetcher.fetch(url, { skipTrackRequest: true });

            const metrics = client.register.metrics({ timestamps: false });
            expect(metrics).toEqual(ExpectedMetricComments);
        });
    });
});
