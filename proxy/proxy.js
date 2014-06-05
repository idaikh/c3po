var app = require('express')(),
   http = require('http'),
   server = http.createServer(app),
   io = require('socket.io').listen(server)

   server.listen(3000);

var http = require('http');
var fs = require('fs');
require('./utils');
var groupService = require('./groups-service');
var userService = require('./users-service');


// Serveur Proxy
app.get('/', function (req, res) {
   res.setHeader("Content-Type", "text/plain");
   res.setHeader('Access-Control-Allow-Origin', '*');
   res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Access-Control-Allow-Origin');
   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
   res.end();
});

io.set('log level', 0);

// Ecouteurs Proxy
io.sockets.on('connection', function (socket) {

   socket.on('registerClient', function (clientId) {
      var client = {
         id: clientId,
         socket: socket.id
      };
      console.log("Registering client : " + clientId + " with socket id : " + client.socket);
      userService.registerUser(client);
   });

   socket.on('periodicGroupsUpdate', function (groups) {
      socket.broadcast.emit('proxyPeriodicGroupsUpdate',groups);
   });

   socket.on('registerNewGroup', function (group) {
      console.log("Registering group id : " + group.id);
      groupService.registerGroup(group);
      groupService.subscribeClientInGroup(group.ownerId, group.id);

      console.log("Broadcasting new group to registered clients");
      socket.broadcast.emit('proxyNewGroup', group);
   });

   socket.on('subscribeGroup', function (data) {
      console.log("Subscribing group id : " + data.groupId + " for user : " + data.clientId);
      groupService.subscribeClientInGroup(data.clientId, data.groupId);
   });

   socket.on('unSubscribeClient', function (data) {
      console.log("Unsubscribing client : " + data.clientId + " from group : " + data.groupId);
      groupService.UnSubscribeClientFromGroup(data.clientId, data.groupId);
   });

   socket.on('newTweet', function (data) {
      console.log("Received new tweet " + data.tweet.content + " from : " + data.tweet.owner + " for group : " + data.groupId +" at date "+ data.date);
      var clientsNamesToContact = groupService.getSubscribedUsersInGroup(data.groupId); 
      var clientsSocketsToContact = userService.getSocketsId(clientsNamesToContact);

      console.log("Broadcasting new tweet to subscribed clients : " + clientsNamesToContact);
      for (var i = 0, len = clientsSocketsToContact.length; i < len; i++) {
         io.sockets.socket(clientsSocketsToContact[i]).emit('proxyNewTweet', data);
      }
   });

    socket.on('likeTweet', function (data) {
      console.log("Received tweet like from group : " + data.groupId + " for tweet : " + data.tweetId);
      var clientsNamesToContact = groupService.getSubscribedUsersInGroup(data.groupId); 
      var clientsSocketsToContact = userService.getSocketsId(clientsNamesToContact);

      console.log("Broadcasting new tweet like to subscribed clients : " + clientsNamesToContact);
      for (var i = 0, len = clientsSocketsToContact.length; i < len; i++) {
         io.sockets.socket(clientsSocketsToContact[i]).emit('likeTweet', data);
      }
   });

});