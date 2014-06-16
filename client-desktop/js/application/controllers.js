angular.module('c3po-desktop')
    .controller("bodyCtrl", function ($scope) {
    })
    .controller("welcomeCtrl", function ($scope, $state, Network, Client, ProxyEventsHandler) {
        $scope.registerNewClient = function (client) {
            client.pseudo = '@' + angular.lowercase(client.firstName) + '' + angular.lowercase(client.lastName);
            client.creationDate = Date.now();
            client.groupPseudos = [];
            // Get user ip
            Network.getIp(function (ip) {
                client.ip = ip;
                client.id = client.mail + '::' + ip;

                // Save client to local storage
                Client.saveClient(client);

                // Registering client to the proxy
                ProxyEventsHandler.emitClient();

                /* Enabling listeners/emitters for proxy events */
                ProxyEventsHandler.listenForPeriodicGroupsUpdate();
                ProxyEventsHandler.listenForNewGroupCreated();
                ProxyEventsHandler.listenForGroupUpdateParticipants();
                ProxyEventsHandler.listenForNewTweets();
                ProxyEventsHandler.listenForCloseGroup();
                ProxyEventsHandler.emitPeriodicGroupUpdate(10000, 5);

                // Redirecting user to the groups main page
                $state.go('c3po.groups.list');
            });
        }
    })
    .controller("mainCtrl", function ($scope, $state, Groups, ProxyEventsHandler, Notifications) {
        $scope.mainData = {};
        $scope.clientGroups = Groups.client.getGroups();
        $scope.subscribedGroups = Groups.subscribed.getGroups();

        // The top header panel is closed by default
        $scope.mainData.panelOpened = false;
        // Left subscribed groups menu collapsed
        $scope.mainData.subscribedGroupsShow = false;
        // Left client groups menu collapsed
        $scope.mainData.clientGroupsShow = false;

        // Watch for new notifications (e.g new group created) to update the view
        $scope.$watch(function () {
            return Notifications.getNotifications();
        }, function (notifications) {
            $scope.mainData.notifications = notifications;
            $scope.mainData.nbNotifications = notifications.length;
        }, true);

        // Watch client/subscribed groups for change to update the left menu
        $scope.$watch(function () {
            return {
                clientGroups: Groups.client.getGroups(),
                subscribedGroups: Groups.subscribed.getGroups()
            };
        }, function (groups) {
            $scope.clientGroups = groups.clientGroups;
            $scope.subscribedGroups = groups.subscribedGroups;
        }, true);

        $scope.removeNotification = function (notif) {
            Notifications.removeNotification(notif);
        }

        $scope.openPanel = function (panelName) {
            $scope.mainData.selectedPanel = panelName;
        }

        $scope.unSubscribeGroup = function (groupId) {
            Groups.unSubscribeGroup(groupId);

            // Unsubscribe user from group to the proxy
            ProxyEventsHandler.emitUnSubscribeGroup(groupId);

            // Redirecting user to the groups main page
            $state.go('c3po.groups.list');
        }

        // Highlight selected top item
        $scope.navClass = function (panelName) {
            return panelName === $scope.mainData.selectedPanel && $scope.mainData.panelOpened === true ? 'item-active' : '';
        };
    })
    .controller("clientCtrl", function ($scope, Client) {
        $scope.clientData = {};
        $scope.clientData.client = Client.getClient();
    })
    .controller("groupsCtrl", function ($scope,LocalEventsHandler) {
        // Used by map directive to tell if map has successfully loaded
        $scope.loader = false;

        $scope.centerOnUser=function(){
            LocalEventsHandler.emitMapUserPosition();
        }
    })
    .controller("listGroupsCtrl", function ($scope, Groups, ProxyEventsHandler, LocalEventsHandler, Geolocation) {
        $scope.globalGroups = Groups.global.getGroups();

        // Watch global groups for change (e.g new group created) to update the view
        $scope.$watch(function () {
            return Groups.global.getGroups();
        }, function (groups) {
            $scope.globalGroups = groups;
        }, true);

        $scope.subscribeGroup = function (groupId) {
            Groups.subscribeGroup(groupId);

            // Subscribe user in group to the proxy
            ProxyEventsHandler.emitSubscribeGroup(groupId);
        }

        $scope.unSubscribeGroup = function (groupId) {
            Groups.unSubscribeGroup(groupId);

            // Unsubscribe user from group to the proxy
            ProxyEventsHandler.emitUnSubscribeGroup(groupId);
        }

        $scope.closeGroup=function(groupId) {
            Groups.updateGroupStatus(groupId);

            // Close group event to the proxy
            ProxyEventsHandler.emitCloseGroup(groupId);
        }

        $scope.isGroupOwner = function (groupId) {
            return Groups.isGroupOwner(groupId);
        }

        $scope.isSubscribedToGroup = function (groupId) {
            return Groups.isSubscribedToGroup(groupId);
        }

        $scope.updateMapView = function (group) {
            var mapData = {
                position: {
                    latitude: group.address.latitude,
                    longitude: group.address.longitude
                },
                groupId: group.id
            };
            LocalEventsHandler.emitUpdateMapView(mapData);
        }
    })
    .controller("addGroupCtrl", function ($scope, $state, Geolocation, Client, Groups, ProxyEventsHandler, LocalEventsHandler, Logger) {
        $scope.useClientLocation = true;

        // Retrieve client position with a promise
        Geolocation.getWatchedPosition().then(function (position) {
            $scope.clientLocalisation = {
                latitude: position.latitude,
                longitude: position.longitude,
                fullAddress: position.fullAddress
            };
        }, function () {
            Logger.log('Could not retrieve client position');
        });


        $scope.registerNewGroup = function (group) {
            var client = Client.getClient();
            // Set the group id with the group name to lowercase without space char and suffix it with the client id
            var newGroupId = angular.lowercase(group.name.replace(/\s+/g, '')) + '::' + Date.now() + '::' + client.id;

            var newGroup = {
                id: newGroupId,
                name: group.name,
                description: group.description,
                creationDate: Date.now(),
                ownerId: client.id,
                ownerPseudo: client.pseudo,
                groupActive:true,
                nbParticipants: 1,
                distanceFromUser: 0
            };

            if ($scope.useClientLocation) {
                newGroup.address = $scope.clientLocalisation;
            }

            // Update client groups local storage
            Groups.client.addGroup({id: newGroup.id, name: newGroup.name});

            // Update global groups local storage
            Groups.global.addGroup(newGroup);

            // Register the created group to the proxy
            ProxyEventsHandler.emitNewGroup(newGroup);

            // Update map to center on the new created group
            var mapData = {
                position: {
                    latitude: newGroup.address.latitude,
                    longitude: newGroup.address.longitude
                },
                groupId: newGroup.id
            };
            LocalEventsHandler.emitUpdateMapView(mapData);

            //Clearing the form
            $scope.createGroup.$setPristine();
            $scope.group = "";

            // Redirect user to the groups list
            $state.go("c3po.groups.list")
        }
    })
    .controller("groupCtrl", function ($scope, $state, $stateParams, Client, Groups, Tweets, ProxyEventsHandler, FileReader) {
        $scope.groupData = {};
        $scope.groupId = $stateParams.groupId;
        $scope.client = Client.getClient();

        if (Client.getClient() != null) {
            $scope.groupData.groupPseudos = Client.getGroupPseudos($scope.groupId);
        }

        $scope.groupData.group = Groups.global.getSingleGroup($scope.groupId);

        // Watch specific group for change (e.g number of subscribed users) to update the view
        $scope.$watch(function () {
            return Groups.global.getSingleGroup($scope.groupId);
        }, function (group) {
            $scope.groupData.group = group;
        }, true);

        // By default, the first radio button is checked
        $scope.groupData.pseudoChoice = "option1";
        $scope.groupData.pseudoDefined = false;

        if (angular.isDefined($scope.groupData.groupPseudos)) {
            $scope.groupData.pseudoList = $scope.groupData.groupPseudos[0];
        }

        // Watch dynamic tweets array for change (e.g new tweet received) to update the view
        $scope.$watch(function () {
            return Tweets.getTweets($scope.groupId);
        }, function (tweets) {
            $scope.groupData.tweets = tweets;
        }, true);

        $scope.definePseudo = function () {
            if ($scope.groupData.pseudoChoice === "option1") {
                $scope.groupData.pseudo = $scope.groupData.pseudoList;
            } else {
                $scope.groupData.pseudo = '@' + $scope.groupData.pseudoInput;
                Client.addGroupPseudo($scope.groupId, $scope.groupData.pseudo);
            }
            $scope.groupData.pseudoDefined = true;
        }

        $scope.getAttachment = function (file) {
            $scope.file = file;
            FileReader.readAsDataUrl(file, $scope)
                .then(function (result) {
                    $scope.groupData.attachmentSrc = result;
                });
        };

        $scope.sendTweet = function (tweet) {
            var newTweet = {
                tweet: {
                    content: tweet,
                    owner: $scope.groupData.pseudo,
                    date: Date.now(),
                    id: $scope.groupId + '' + $scope.client.id + '::' + Date.now()
                },
                groupId: $scope.groupId,
                ownerId: $scope.client.id
            }
            if ($scope.groupData.attachmentSrc != "" && $scope.groupData.attachmentSrc != null && $scope.groupData.attachmentSrc != 'undefined') {
                newTweet.tweet.attachment = $scope.groupData.attachmentSrc;
            }

            // Emit a 'newTweet' event to the proxy to broadcast the new tweet to the registered clients
            ProxyEventsHandler.emitNewTweet(newTweet);

            // Clear tweet input & attachment
            $scope.groupData.tweet = "";
            $scope.groupData.attachmentSrc = "";
        }

        $scope.isGroupOwner = function (groupId) {
            return Groups.isGroupOwner(groupId);
        }

        $scope.isSubscribedToGroup = function (groupId) {
            return Groups.isSubscribedToGroup(groupId);
        }

        $scope.unSubscribeGroup = function (groupId) {
            Groups.unSubscribeGroup(groupId);

            // Unsubscribe user from group to the proxy
            ProxyEventsHandler.emitUnSubscribeGroup(groupId);

            // Redirect user to the groups list
            $state.go("c3po.groups.list")
        }
    });