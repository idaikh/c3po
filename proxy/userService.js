"use strict";
var utils=require('./utils'),
    logger=require('./loggerService'),
    colors = require('colors');

function UserService() {
    var registeredUsers = [];

    // If user exists, only his socket is updated
    function userExists(user) {
        for (var i = 0, len = registeredUsers.length; i < len; i++) {
            if (user.id === registeredUsers[i].id) {
                logger.log("User "+user.id.yellow.bold+" already registered, updating his socket "+user.socket.green.bold);
                registeredUsers[i].socket = user.socket;
                return true;
            }
        }
        return false;
    }

    var self = {
        registerUser: function (user) {
            if (!userExists(user)) {
                logger.log("Registering client " + user.id.yellow.bold + " with socket id " + user.socket.green.bold);
                registeredUsers.push(user);
            }
        },
        getRegisteredUsers: function () {
            var registeredUsersId = [];
            if(registeredUsers!=null && registeredUsers!='undefined') {
                for (var i = 0, len = registeredUsers.length; i < len; i++) {
                    registeredUsersId.push(registeredUsers[i].id);
                }
                return registeredUsersId;
            }else {
                return [];
            }
        },
        getSocketsId: function (users) {
            var sockets = [];

            for (var i = 0, len = registeredUsers.length; i < len; i++) {
                for (var y = 0, len2 = users.length; y < len2; y++) {
                    if (users[y] == registeredUsers[i].id) {
                        sockets.push(registeredUsers[i].socket);
                    }
                }
            }
            return sockets;
        }
    }
    return self;
}

module.exports = UserService();