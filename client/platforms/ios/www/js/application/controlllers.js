angular.module('c3po')
.controller('mainCtrl', function ($scope, $rootScope, Groups, Client, EventsManager) {
  $scope.mainView = {};

  $scope.menuToggle = false;
  $scope.isOwnGroupsCollapsed = true;
  $scope.isSubscribedGroupsCollapsed = true;

  $scope.mainView.clientGroups = Groups.getClientGroups();
  $scope.mainView.subscribedGroups = Groups.getSubscribedGroups("subscribedGroups");

  $scope.isUserRegistered = function () {
     //return false if no item 'client' exists in local storage
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
     EventsManager.unSubscribeGroupAnnounce(groupId);
     $scope.mainView.subscribedGroups = Groups.getSubscribedGroups("subscribedGroups");
  }

  $scope.$on("clientGroupsUpdated", function () {
     $scope.mainView.clientGroups = Groups.getClientGroups();
  });

  $scope.$on("subscribedGroupsUpdated", function () {
     $scope.mainView.subscribedGroups = Groups.getSubscribedGroups("subscribedGroups");
  });
})
.controller('clientCtrl', function ($scope, $state, Network, Client) {
  $scope.userView = {};
  $scope.userView.client = Client.getClient();

  $scope.createNewClient = function (client) {
     client.pseudo = '@' + angular.lowercase(client.firstName) + '' + angular.lowercase(client.lastName);
     Network.getIp(function (ip) {
        client.ip = ip;
        client.id = client.pseudo + '::' + ip;
        Client.saveClient(client);

        $state.go('groups');
     });
  }
})
.controller('groupsCtrl', function ($scope, $rootScope, Client, Groups, EventsManager) {
  var client = Client.getClient();
  $scope.groupsView = {};
  $scope.groupsView.groups = Groups.getGlobalGroups();

  if ($rootScope.proxyOnline && !$rootScope.groupsEventsRegistered) {
     $rootScope.groupsEventsRegistered = true;
     //Registering the new client
     EventsManager.sendClient();
     //Registering for periodic groups announce event from other clients. This will fire a 'eventUpdateGlobalGroups' local events.
     EventsManager.registerGroupAnnounce();
     //Registering for new group announce event. This will fire a 'eventUpdateGlobalGroups' local events.
     EventsManager.registerNewGroupAnnounce();
     //Emit periodic groups announce
     EventsManager.enablePeriodicGroupAnnounce(2000);
  }

  $scope.$on("eventUpdateGlobalGroups", function () {
     $scope.groupsView.groups = Groups.getGlobalGroups();
  });

  $scope.$on("menuUnsubscribeGroup", function () {
     //TODO         //         $scope.unSubscribeGroup(groupId);
  });

  $scope.isGroupOwner = function (groupOwnerId) {
     return client.id == groupOwnerId ? true : false;
  }

  $scope.subscribeGroup = function (groupId) {
     // Update client subscribed groups local storage
     var globalGroups = Groups.getGlobalGroups();
     var subscribedGroups = Groups.getSubscribedGroups();
     for (var i = 0, len = globalGroups.length; i < len; i++) {
        if (globalGroups[i].id === groupId) {
           subscribedGroups.unshift(globalGroups[i]);
        }
     }
     Groups.setSubscribedGroups(subscribedGroups);
     // Emit a local event to update the left client subscribed groups menu
     $scope.$emit("subscribedGroupsUpdated");
     // Emit a 'subscribeGroup' event to the Proxy to subscribe the client for the specified group
     EventsManager.subscribeGroupAnnounce(groupId);
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
     $scope.$emit("subscribedGroupsUpdated");
     // Emit a 'unSubscribeClient' event to the Proxy to unsubscribe the client from the specified group
     EventsManager.unSubscribeGroupAnnounce(groupId);

     $scope.isSubscribedToGroup(groupId);
  }

  $scope.isSubscribedToGroup = function (groupId) {
     var subscribedGroups = Groups.getSubscribedGroups();
     if (Groups.getSubscribedGroups() != null) {
        for (var i = 0, len = subscribedGroups.length; i < len; i++) {
           if (subscribedGroups[i].id === groupId) {
              return true;
           }
        }
     }
     return false;
  }
})
.controller('groupsAddCtrl', function ($scope, $state, Groups, Client, EventsManager, Geolocation) {
  $scope.groupsAddView = {};
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
     var clientGroups = Groups.getClientGroups();
     var globalGroups = Groups.getGlobalGroups();

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

     //Update client own groups local storage
     clientGroups.unshift(newGroup);
     Groups.setClientGroups(clientGroups);

     //Update global groups local storage
     globalGroups.unshift(newGroup);
     Groups.setGlobalGroups(globalGroups);

     // Emit a local event to update the left client own groups menu
     $scope.$emit("clientGroupsUpdated");

     // Emit a 'registerGroup' event to the proxy to register the new group
     EventsManager.sendGroup(newGroup);

     //Clearing the form
     $scope.createGroup.$setPristine();
     $scope.groupsAddView = "";
     $scope.groupAlert = true;

     $state.go("groups");
  }
})
.controller('groupCtrl', function ($scope, $rootScope, $stateParams, $filter, Proxy, Groups, Client, Tweets, EventsManager) {
  var client = Client.getClient();
  $scope.groupView = {};
  $scope.groupView.group = Groups.getGlobalGroup($stateParams.id);
  $scope.groupView.tweets = Tweets.getTweets($scope.groupView.group.id);

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
     EventsManager.sendTweet(newTweet);

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

  $scope.likeTweet = function (tweetId, $index) {
     EventsManager.sendTweetLike($scope.groupView.group.id, tweetId);
  }

  if (!$rootScope.eventAlreadyRegistered) {
     $rootScope.eventAlreadyRegistered = true;
     Proxy.webSocket.on("newTweet", function (newTweet) {
        if (!(newTweet.ownerId == client.id)) {
           Tweets.addTweet({
              owner: newTweet.tweet.owner,
              content: newTweet.tweet.content,
              date: newTweet.tweet.date,
              id: newTweet.tweet.id
           }, newTweet.groupId);
           $scope.groupView.tweets = Tweets.getTweets($scope.groupView.group.id);
        }
     });
     EventsManager.registerTweetLikeAnnounce();
  }

});