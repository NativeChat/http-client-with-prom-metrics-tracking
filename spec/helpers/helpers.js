'use strict';

const express = require('express');
const { TestServer } = require('../constants');

const startServer = async () => {
    return new Promise((resolve) => {
        const app = express()
        let calledCount = 0;
        app.get(TestServer.TextEndpointPath, (req, res) => res.send(TestServer.TextEndpointResponseText));
        app.get(TestServer.JSONEndpointPath, (req, res) => res.json(TestServer.JSONEndpointResponseObject));
        app.get(TestServer.ReturnOnThirdTimePath, (req, res) => {
            if (++calledCount % 3) {
                res.destroy();
            } else {
                res.send(TestServer.ReturnOnThirdTimeResult)
            }
        });
        app.get(TestServer.SlowEndpointPath, (req, res) => {
            setTimeout(() => res.send(TestServer.SlowEndpointResult), TestServer.SlowEndpointDelayMilliseconds);
        });
        app.get(TestServer.ErrorEndpointPath, (req, res) => res.destroy());
        const server = app.listen(TestServer.Port, () => { resolve(server) });
    });
}

const verifyMetricsResponse = async (expectedMetrics, port) => {
    const metricsResponse = await httpGet(`http://localhost:${port}/metrics`);

    expectedMetrics.forEach((expectedMetric) => {
        expect(metricsResponse).toContain(expectedMetric);
    });
};

module.exports = { verifyMetricsResponse, startServer };
