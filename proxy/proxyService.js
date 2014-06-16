"use strict";
var group = require('./groupService'),
    user = require('./userService'),
    logger=require('./loggerService'),
    colors = require('colors');

function ProxyService() {
    var io, server;
    return {
        configure: function (ioParam, serverParam) {
            io = ioParam;
            server = serverParam;
            // Disable socket.io logger, instead we'll use our own logger
            io.set('log level', 0);
        },
        start: function (port) {
            logger.log("Server listening on port "+port);
            server.listen(port);
        },
        emitNbOfParticipants:function(groupIdParam) {
            var nbParticipants=group.getSubscribedUsersInGroup(groupIdParam).length;
            io.sockets.emit('updateGroupParticipants',{groupId:groupIdParam,participants:nbParticipants});
            logger.log("Broadcasting participants update for group " + groupIdParam.red.bold);
        },
        setEvents: function () {
            var _this=this;
            io.sockets.on('connection', function (socket) {

                socket.on('registerClient', function (clientId) {
                    var client = {
                        id: clientId,
                        socket: socket.id
                    };
                    user.registerUser(client);
                });

                socket.on('registerNewGroup', function (groupParam) {
                    group.registerGroup(groupParam);
                    group.subscribeClientInGroup(groupParam.ownerId, groupParam.id);
                    logger.log("Registering new group " + groupParam.id.red.bold);
                    logger.log("Broadcasting new group to registered clients " + user.getRegisteredUsers().join().yellow.bold);
                    socket.broadcast.emit('proxyNewGroup', groupParam);
                });

                socket.on('periodicGroupsUpdate', function (groups) {
                    socket.broadcast.emit('proxyPeriodicGroupsUpdate', groups);
                });

                socket.on('closeGroup', function (groupId) {
                    socket.broadcast.emit('closeGroup', groupId);
                });

                socket.on('subscribeGroup', function (data) {
                    group.subscribeClientInGroup(data.clientId, data.groupId);
                    logger.log("User "+data.clientId.yellow.bold+" subscribed to group " + data.groupId.red.bold);
                    _this.emitNbOfParticipants(data.groupId);
                });

                socket.on('unSubscribeClient', function (data) {
                    group.UnSubscribeClientFromGroup(data.clientId, data.groupId);
                    logger.log("User "+data.clientId.yellow.bold+" unsubscribed from group " + data.groupId.red.bold);
                    _this.emitNbOfParticipants(data.groupId);
                });

                socket.on('newTweet', function (data) {
                    var clientsNamesToContact = group.getSubscribedUsersInGroup(data.groupId);
                    var clientsSocketsToContact = user.getSocketsId(clientsNamesToContact);
                    logger.log("Received new tweet " + data.tweet.content.grey.bold + " from " + data.tweet.owner.yellow.bold + " for group " + data.groupId.red.bold);
                    logger.log("Broadcasting new tweet to subscribed clients " + clientsNamesToContact.join().yellow.bold +" with sockets "+clientsSocketsToContact.join().red.bold);
                    for (var i = 0, len = clientsSocketsToContact.length; i < len; i++) {
                        io.sockets.socket(clientsSocketsToContact[i]).emit('proxyNewTweet', data);
                    }
                });

                socket.on('likeTweet', function (data) {
                    logger.log("Received tweet like from group : " + data.groupId + " for tweet : " + data.tweetId);
                    var clientsNamesToContact = group.getSubscribedUsersInGroup(data.groupId);
                    var clientsSocketsToContact = user.getSocketsId(clientsNamesToContact);

                    logger.log("Broadcasting new tweet like to subscribed clients : " + clientsNamesToContact);
                    for (var i = 0, len = clientsSocketsToContact.length; i < len; i++) {
                        io.sockets.socket(clientsSocketsToContact[i]).emit('likeTweet', data);
                    }
                });

            });
        }
    };
}

module.exports = ProxyService();