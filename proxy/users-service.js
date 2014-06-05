"use strict";
require('./utils');

function UserService() {
   var registeredUsers = [];

   function userExists(user) {
      for (var i = 0, len = registeredUsers.length; i < len; i++) {
         if (user.id === registeredUsers[i].id) {
            registeredUsers[i].socket = user.socket;
            return true;
         }
      }
      return false;
   }

   var self = {
      registerUser: function (user) {
         if (!userExists(user)) {
            registeredUsers.push(user);
         }
      },
      getRegisteredUsers: function () {
         var registeredUsersId = [];
         for (var i = 0, len = registeredUsers.length; i < len; i++) {
            registeredUsersId.push(registeredUsers[i].id);
         }
         return registeredUsersId;
      },
      getSocketsId: function (users) {
         var sockets = [];

         for (var i = 0, len = registeredUsers.length; i < len; i++) {
            for (var y = 0, len = users.length; y < len; y++) {
               if (users[y] === registeredUsers[i].id) {
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