var app = require('express')(),
    fs = require('fs'),
    http = require('http'),
    server = http.createServer(app),
    io = require('socket.io').listen(server),
    logger=require('./loggerService'),
    proxy=require('./proxyService');

// Global Error Handler
process.on('uncaughtException', function (err) {
    logger.log(err.stack);
});

// Configure socket.io options
proxy.configure(io,server);
// Start proxy. @param: port the proxy is running on
proxy.start(3000);
// Set all event listeners/emitters for the client application
proxy.setEvents();

// Set up proxy routing. A get request to the root path is issued by the client application to ensure that the proxy is running
app.get('/', function (req, res) {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Access-Control-Allow-Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.end();
});