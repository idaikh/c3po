angular.module('c3po')
   .factory('Proxy', function ($http, $rootScope, LocalStorage) {
      var socket = {};
      return {
         isConnected: function (onSuccess, onError) {
            $http.get("http://127.0.0.1:3000").then(function (response) {
               onSuccess();
            }, function (response) {
               onError();
            });
         },
         getWebSocket: function () {
            return socket;
         },
         webSocket: {
            on: function (eventName, callback) {
               socket.on(eventName, function () {
                  var args = arguments;
                  $rootScope.$apply(function () {
                     callback.apply(socket, args);
                  });
               });
            },
            emit: function (eventName, args) {
               socket.emit(eventName, args);
            },
            connect: function (onSuccess, onError) {
               try {
                  socket = io.connect('http://127.0.0.1:3000', {
                     'reconnection delay': 1000, // defaults to 500
                     'reconnection limit': 100, // defaults to Infinity
                     'max reconnection attempts': Infinity // defaults to 10
                  });
                  onSuccess(socket);
               } catch (e) {
                  console.log(e);
                  onError();
               }
            },
            isLoaded: function () {
               try {
                  if (io != null) {
                     if (socket) {
                        return true;
                     } else {
                        return false;
                     }
                     return true;
                  } else {
                     return false;
                  }
               } catch (e) {
                  return false;
               }
            }
         }
      }
   })
   .factory('Groups', function (LocalStorage) {
      return {
         getGlobalGroup: function (groupId) {
            var globalGroups = LocalStorage.getParsed("globalGroups");
            for (var i = 0, len = globalGroups.length; i < len; i++) {
               if (globalGroups[i].id === groupId) {
                  return globalGroups[i];
               }
            }
            return null;
         },
         getGlobalGroups: function () {
            return LocalStorage.getParsed("globalGroups");
         },
         setGlobalGroups: function (globalGroups) {
            LocalStorage.save("globalGroups", globalGroups);
         },
         globalGroupExists: function (groupId) {
            var globalGroups = LocalStorage.getParsed("globalGroups");
            for (var i = 0, len = globalGroups.length; i < len; i++) {
               if (globalGroups[i].id === groupId) {
                  return true;
               }
            }
            return false;
         },
         getClientGroups: function () {
            return LocalStorage.getParsed("clientGroups");
         },
         setClientGroups: function (clientGroups) {
            LocalStorage.save("clientGroups", clientGroups);
         },
         getSubscribedGroups: function () {
            return LocalStorage.getParsed("subscribedGroups");
         },
         setSubscribedGroups: function (subscribedGroups) {
            LocalStorage.save("subscribedGroups", subscribedGroups);
         }
      }
   })
   .factory('Client', function (LocalStorage) {
      return {
         getClient: function (groupId) {
            return LocalStorage.getParsed("client");
         },
         saveClient: function (client) {
            LocalStorage.save("client", client);
         }
      }
   })
   .factory('Tweets', function (LocalStorage) {
      var tweets = {};

      var checkIfGroupExists = function (groupId) {
         if (!tweets[groupId]) {
            tweets[groupId] = {
               'tweets': []
            };
            return false;
         } else {
          return true;  
         }
      }
      return {
         addTweet: function (tweet, groupId) {
            checkIfGroupExists(groupId);
            tweets[groupId]["tweets"].unshift({
               owner: tweet.owner,
               content: tweet.content,
               date: tweet.date,
               id:tweet.id,
               liked:0
            });
         },
         getTweets: function (groupId) {
            checkIfGroupExists(groupId);
            return tweets[groupId].tweets;
         },
         likeTweet: function(groupId,tweetId) {
            if(checkIfGroupExists(groupId)) {
               for(var i=0;i<tweets[groupId].tweets.length;i++) {
                  if(tweets[groupId].tweets[i].id==tweetId) {
                     tweets[groupId].tweets[i].liked++;
                     console.log(tweets[groupId].tweets[i]);
                  }
               }
                
            }
         }
      }
   })
   .factory('Network', function ($http) {
      return {
         getIp: function (onSuccess, onError) {
            $http.get("http://ip.jsontest.com/").then(function (response) {
               onSuccess(response.data.ip);
            }, function (response) {
               onSuccess("127.0.0.1");
            });
         }
      }
   })
   .factory('Geolocation', function ($window, $q) {
      var geolocation = $window.navigator.geolocation;
      var options = {
         maximumAge: 10000,
         timeout: 60000,
         enableHighAccuracy: true
      };
      var clientPosition;

      return {
         updatePosition: function (newPosition) {
            clientPosition = newPosition;
         },
         resolveLatLong: function (latitude, longitude) {
            var deferred = $q.defer();
            var promise = deferred.promise;
            var latlng = new google.maps.LatLng(latitude, longitude);
            var geocoder = new google.maps.Geocoder()

            geocoder.geocode({
               location: latlng
            }, function (result, status) {
               if (status == google.maps.GeocoderStatus.OK) {
                  deferred.resolve(result[0].formatted_address);
               } else {
                  deferred.resolve(null);;
               }
            });

            return promise;
         },
         getWatchedPosition: function () {
            var deferred = $q.defer();
            var promise = deferred.promise;
            var that = this;

            if (!clientPosition) {
               this.getCurrentPosition(function (position) {
                  var fullAddress = that.resolveLatLong(position.coords.latitude, position.coords.longitude).then(function (address) {
                     deferred.resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        fullAddress: address
                     });
                  });
               });
            } else {
               var fullAddress = that.resolveLatLong(clientPosition.coords.latitude, clientPosition.coords.longitude).then(function (address) {
                  deferred.resolve({
                     latitude: clientPosition.coords.latitude,
                     longitude: clientPosition.coords.longitude,
                     fullAddress: address
                  });
               });
            }

            return promise;
         },
         getCurrentPosition: function (onSuccess, onError) {
            geolocation.getCurrentPosition(onSuccess, onError, options);
         },
         watchPosition: function () {
            geolocation.watchPosition(this.updatePosition, function () {}, options);
         }
      }
   })
   .factory('EventsManager', function (Proxy, Groups, $rootScope, $timeout, Client,Tweets) {
      var globalGroups;
      return {
         sendClient: function () {
            Proxy.webSocket.emit("registerUser", Client.getClient().id);
         },
         sendGroup: function (newGroup) {
            Proxy.webSocket.emit("registerGroup", newGroup);
         },
         sendTweet:function(tweet) {
            Proxy.webSocket.emit("newTweet", tweet);
         },
         sendTweetLike:function(idGroup,tweetId) {
            Proxy.webSocket.emit("likeTweet", {groupId:idGroup,tweetId:tweetId});
         },
         registerGroupAnnounce: function () {
            Proxy.webSocket.on("groupsAnnounceProxy", function (groups) {
               // Update local storage if group doesn't exist
               if (groups && groups instanceof Array) {
                  globalGroups = Groups.getGlobalGroups();
                  for (var i = 0, len = groups.length; i < len; i++) {
                     if (!Groups.globalGroupExists(groups[i].id)) {
                        globalGroups.unshift(groups[i]);
                        Groups.setGlobalGroups(globalGroups);
                        // Send local event to update global Groups
                        $rootScope.$broadcast("eventUpdateGlobalGroups");
                     }
                  }
               }
            })
         },
         registerNewGroupAnnounce: function () {
            Proxy.webSocket.on("newGroupCreated", function (group) {
               // Update local storage if group doesn't exist
               if (!Groups.globalGroupExists(group.id)) {
                  globalGroups = Groups.getGlobalGroups();
                  globalGroups.unshift(group);
                  Groups.getGlobalGroups(globalGroups);
                  // Send local event to update global Groups
                  $rootScope.$broadcast("eventUpdateGlobalGroups");
               }
            })
         },
         test:function() {
            $rootScope.$broadcast("menuUnsubscribeGroup");
         },
         registerTweetLikeAnnounce: function () {
             Proxy.webSocket.on("likeTweet", function (data) {
                Tweets.likeTweet(data.groupId,data.tweetId);
             });
         },
         enablePeriodicGroupAnnounce: function (period) {
            var announceGroups = function () {
               if (Groups.getGlobalGroups() instanceof Array && Groups.getGlobalGroups().length != 0) {
                  Proxy.webSocket.emit("groupsAnnounce", Groups.getGlobalGroups());
               }
               $timeout(announceGroups, period);
            }
            $timeout(announceGroups, period);
         },
         subscribeGroupAnnounce: function (groupId) {
            Proxy.webSocket.emit("subscribeGroup", {
               clientId: Client.getClient().id,
               groupId: groupId
            });
         },
         unSubscribeGroupAnnounce: function (groupId) {
            Proxy.webSocket.emit("unSubscribeClient", {
               clientId: Client.getClient().id,
               groupId: groupId
            });
         }
      };
   })
   .factory('LocalStorage', function () {
      return {
         get: function (key) {
            return localStorage.getItem(key);
         },
         getParsed: function (key) {
            return JSON.parse(localStorage.getItem(key));
         },
         save: function (key, data) {
            localStorage.setItem(key, JSON.stringify(data));
         },

         remove: function (key) {
            localStorage.removeItem(key);
         },

         clearAll: function () {
            localStorage.clear();
         }
      };
   });