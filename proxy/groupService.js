"use strict";
var logger = require('./loggerService'),
    colors = require('colors');

function GroupService() {
    var groups = [];

    function getGroupIndex(groupId) {
        for (var i = 0, len = groups.length; i < len; i++) {
            if (groups[i].id === groupId) {
                return i;
            }
        }
        return null;
    }

    var self = {
        registerGroup: function (group) {
            group.clients = [];
            groups.push(group);
        },
        subscribeClientInGroup: function (clientId, groupId) {
            var groupIndex = getGroupIndex(groupId);
            if (groupIndex != null) {
                if (groups[groupIndex]['clients'] != null && groups[groupIndex]['clients'] != 'undefined') {
                    groups[groupIndex]['clients'].push(clientId);
                } else {
                    logger.log("Could not subscribe client " + clientId.yellow.bold + " in group " + groupId.red.bold)
                }
            } else {
                logger.log("Could not subscribe client " + clientId.yellow.bold + " in group " + groupId.red.bold)
            }
        },
        UnSubscribeClientFromGroup: function (clientId, groupId) {
            var groupIndex = getGroupIndex(groupId);
            if (groupIndex != null) {
                var i = groups[groupIndex]['clients'].indexOf(clientId);
                if (i != -1) {
                    groups[groupIndex]['clients'].splice(i, 1);
                }
            }
        },
        getSubscribedUsersInGroup: function (groupId) {
            var groupIndex = getGroupIndex(groupId);
            if (groupIndex != null) {
                return groups[groupIndex]['clients'];
            }
            return [];
        },
        getRegisteredGroups: function () {
            var registeredGroups = [];
            for (var i = 0, len = groups.length; i < len; i++) {
                registeredGroups.push(groups[i]);
            }
            return registeredGroups;
        }
    }
    return self;
}

module.exports = GroupService();