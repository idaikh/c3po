angular.module('c3po')
    .controller('mainCtrl', function ($scope, $rootScope, Groups, Client) {
        $scope.mainView = {};

        $scope.menuToggle = false;
        $scope.isOwnGroupsCollapsed = true;
        $scope.isSubscribedGroupsCollapsed = true;

        $scope.mainView.clientGroups = Groups.getClientGroups();
        $scope.mainView.subscribedGroups = Groups.getSubscribedGroups("subscribedGroups");

        $scope.isUserRegistered = function () {
            // return false if no item 'client' exists in local storage
            return Client.getClient() != null;
        }

        $scope.menuUnsubscribeGroup = function (groupId) {
            //TODO : MANAGE IT WITH AN EVENT
            var subscribedGroups = Groups.getSubscribedGroups();
            for (var i = 0, len = subscribedGroups.length; i < len; i++) {
                if (subscribedGroups[i].id === groupId) {
                    subscribedGroups.splice(i, 1);
                    Groups.setSubscribedGroups(subscribedGroups);
                    break;
                }
            }
            // Emit a 'unSubscribeClient' event to the Proxy to unsubscribe the client from the specified group
            ProxyEventsHandler.emitUnSubscribeGroup(groupId);
            $scope.mainView.subscribedGroups = Groups.getSubscribedGroups("subscribedGroups");
        }

        $scope.$on("clientGroupsUpdated", function () {
            $scope.mainView.clientGroups = Groups.getClientGroups();
        });

        $scope.$on("subscribedGroupsUpdated", function () {
            $scope.mainView.subscribedGroups = Groups.getSubscribedGroups("subscribedGroups");
        });
    })
    .controller('clientCtrl', function ($scope, $state, Network, Client, ProxyEventsHandler) {
        $scope.userView = {};
        $scope.userView.client = Client.getClient();

        $scope.createNewClient = function (client) {
            client.pseudo = '@' + angular.lowercase(client.firstName) + '' + angular.lowercase(client.lastName);
            Network.getIp(function (ip) {
                client.ip = ip;
                client.id = client.pseudo + '::' + ip;
                Client.saveClient(client);

                //Registering the new client
                ProxyEventsHandler.emitClient();

                $state.go('groups');
            });
        }
    })
    .controller('groupsCtrl', function ($scope, $rootScope, Client, Groups, ProxyEventsHandler) {
        var client = Client.getClient();
        $scope.groupsView = {};
        $scope.groupsView.groups = Groups.getGlobalGroups();

        /**
         *  Enabling periodic groups emitter
         */
        ProxyEventsHandler.emitPeriodicGroupUpdate(10000);

        /**
         *  Event watcher updating the view
         */
        $rootScope.$on('groupsUpdated', function () {
            $scope.groupsView.groups = Groups.getGlobalGroups();
        })


        $scope.subscribeGroup = function (groupId) {
            var globalGroups = Groups.getGlobalGroups();
            var subscribedGroups = Groups.getSubscribedGroups();
            for (var i = 0, len = globalGroups.length; i < len; i++) {
                if (globalGroups[i].id === groupId) {
                    // Update client subscribed groups local storage
                    subscribedGroups.unshift(globalGroups[i]);
                }
            }
            Groups.setSubscribedGroups(subscribedGroups);

            // Emit a local event to update the left client subscribed groups menu
            $scope.$emit("subscribedGroupsUpdated");

            // Emit a 'subscribeGroup' event to the Proxy to subscribe the client for the specified group
            ProxyEventsHandler.emitSubscribeGroup(groupId);
        }

        $scope.unSubscribeGroup = function (groupId) {
            var subscribedGroups = Groups.getSubscribedGroups();
            for (var i = 0, len = subscribedGroups.length; i < len; i++) {
                if (subscribedGroups[i].id === groupId) {
                    subscribedGroups.splice(i, 1);
                    Groups.setSubscribedGroups(subscribedGroups);
                    break;
                }
            }
            Groups.setSubscribedGroups(subscribedGroups);

            // Emit a local event to update the left client subscribed groups menu
            $scope.$emit("subscribedGroupsUpdated");

            // Emit a 'unSubscribeClient' event to the Proxy to unsubscribe the client from the specified group
            ProxyEventsHandler.emitUnSubscribeGroup(groupId);
        }

    })
    .controller('groupsAddCtrl', function ($scope, $state, Geolocation, Groups, Client, ProxyEventsHandler) {
        $scope.groupsAddView = {};
        $scope.groupsAddView.group={};
        $scope.groupAlert = false;

        $scope.groupsAddView.loader = true;
        $scope.groupsAddView.useClientLocation = true;

        Geolocation.getWatchedPosition().then(function (position) {
            $scope.groupsAddView.loader = false;
            $scope.groupsAddView.clientLocalisation = {
                latitude: position.latitude,
                longitude: position.longitude,
                fullAddress: position.fullAddress
            };
        }, function () {
            $scope.groupsAddView.loader = false;
            console.log('error', 'Unable to determine client position');
        });

        $scope.createNewGroup = function (group) {
            var client = Client.getClient();
            var newGroupId = angular.lowercase(group.name.replace(/\s+/g, '')) + '' + client.id;

            var newGroup = {
                id: newGroupId,
                name: group.name,
                description: group.description,
                date: Date.now(),
                ownerId: client.id,
                ownerPseudo: client.pseudo
            };

            if ($scope.groupsAddView.useClientLocation) {
                newGroup.address = $scope.groupsAddView.clientLocalisation;
            }

            // Update client own groups local storage
            Groups.addClientGroup(newGroup);

            // Update global groups local storage
            Groups.addGlobalGroup(newGroup);

            // Emit a local event to update the left client own groups menu
            $scope.$emit("clientGroupsUpdated");

            // Emit a 'registerGroup' event to the proxy to register the new group
            ProxyEventsHandler.emitNewGroup(newGroup);

            //Clearing the form
            $scope.createGroup.$setPristine();
            $scope.groupsAddView = "";
            $scope.groupAlert = true;

            $state.go("groups");
        }
    })
    .controller('groupCtrl', function ($scope, $rootScope, $stateParams, $filter, Proxy, ProxyEventsHandler, Groups, Client, Tweets) {
        var client = Client.getClient();

        $scope.groupView = {};
        $scope.groupView.group = Groups.getGlobalGroup($stateParams.id);
        $scope.groupView.tweets = Tweets.getTweets($scope.groupView.group.id);

        /**
         *  Event watcher updating the view
         */
        $rootScope.$on('tweetsUpdated', function () {
            $scope.groupView.tweets = Tweets.getTweets($scope.groupView.group.id);
        })

        $scope.sendTweet = function (tweet) {
            var newTweet = {
                tweet: {
                    content: tweet,
                    owner: client.pseudo,
                    date: Date.now(),
                    id: $scope.groupView.group.id + '' + client.id + '::' + Date.now()
                },
                groupId: $scope.groupView.group.id,
                ownerId: client.id
            }

            // Emit a 'newTweet' event to the proxy to broadcast the new tweet to the registered clients
            ProxyEventsHandler.emitNewTweet(newTweet);

            // Add tweet to the dynamic array (tweets are not stored in local storage)
            Tweets.addTweet({
                owner: newTweet.tweet.owner,
                content: newTweet.tweet.content,
                date: newTweet.tweet.date,
                id: newTweet.tweet.id
            }, $scope.groupView.group.id);

            $scope.groupView.tweets = Tweets.getTweets($scope.groupView.group.id);
            $scope.groupView.clientTweet = "";
        }
    })
    .controller("mapCtrl", function ($scope) {
    });