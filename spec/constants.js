'use strict';

const port = 3333;

module.exports = {
    TestServer: {
        Port: port,
        BaseUrl: `http://localhost:${port}`,
        CloseEndpointPath: '/close',
        TextEndpointPath: '/text',
        TextEndpointResponseText: 'Some simple text',
        JSONEndpointPath: '/json',
        JSONEndpointResponseObject: { test: true },
        ReturnOnThirdTimePath: '/thirdTimesTheCharm',
        ReturnOnThirdTimeResult: 'resolved',
        SlowEndpointDelayMilliseconds: 5001,
        SlowEndpointPath: '/slow',
        SlowEndpointResult: 'slow but steady',
        ErrorEndpointPath: '/error',
    }
};
