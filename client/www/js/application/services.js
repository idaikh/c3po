angular.module('c3po')
/**
 *  Factory: C3poApp
 *  Application bootstrap/setup factory
 */
    .factory('C3poApp', function ($rootScope, $location, LocalStorage, Groups, Proxy, Client, Geolocation, ProxyEventsHandler, LocalEventsHandler) {
        return {
            bootstrap: function () {
                //Globals
                $rootScope.eventAlreadyRegistered = false;
                $rootScope.proxyOnline = false;


                if ($rootScope.devMode) {
                    LocalStorage.clear();
                }

                /**
                 *  Set up local Storage items. If an item is not present, defines it with an empty array.
                 */
                (function setUpLocalStorage() {
                    var clientGroups = Groups.getClientGroups();
                    var subscribedGroups = Groups.getSubscribedGroups();
                    var globalGroups = Groups.getGlobalGroups();

                    if (clientGroups === null || clientGroups === "") {
                        Groups.setClientGroups([]);
                    }

                    if (subscribedGroups === null || subscribedGroups === "") {
                        Groups.setSubscribedGroups([]);
                    }

                    if (globalGroups === null || globalGroups === "") {
                        Groups.setGlobalGroups([]);
                    }
                })();

                /**
                 *  Set up the proxy. Listens for connect/disconnect events and set the proxyOnline global accordingly.
                 *  Some application functionalities may be locked based on this global value.
                 */
                (function setUpProxy() {
                    Proxy.webSocket.connect(function () {
                        Proxy.webSocket.on('connect', function () {
                            $rootScope.proxyOnline = true;

                            /**
                             *  Enabling listeners for proxy events
                             */
                            ProxyEventsHandler.listenForPeriodicGroupsUpdate();
                            ProxyEventsHandler.listenForNewGroupCreated();
                            ProxyEventsHandler.listenForNewTweets();

                            if (Client.getClient() != null) {
                                /* Registering client to the proxy if a client item is found on the local storage.
                                 This will cause a socket update on the proxy (if the client hasn't launched the application
                                 for a long time the socket will be closed by the proxy, we have to re enable it) */
                                Proxy.webSocket.emit("registerClient", Client.getClient().id);
                            }
                        });
                        Proxy.webSocket.on('disconnect', function () {
                            $rootScope.proxyOnline = false;
                            console.log('error', "Proxy went offline");
                        });
                    }, function () {
                        $rootScope.proxyOnline = false;
                        console.log('error', "Error while trying to connect to Proxy");
                    });
                })();
            },
            configure: function () {
                /**
                 *  Set up a watcher on client localisation change. Client position can be then retrieved without
                 *  waiting time.
                 */
                (function startPositionWatcher() {
                    /*    */
                    Geolocation.watchPosition();
                })();

                /**
                 *  Enabling listeners for local events
                 */
                LocalEventsHandler.listenForNewGroupCreated();
                LocalEventsHandler.listenForPeriodicGroupsUpdate();
                LocalEventsHandler.listenForNewTweets();


                /**
                 *  Set up an event listener on url location change. Checks on every url location change if the client
                 *  localStorage stills exist, if so redirects the user to the registration page. This situation can
                 *  occur if the client has cleared his browser local storage.
                 */
                $rootScope.$on("$stateChangeSuccess",
                    function (event, toState, toParams, fromState, fromParams) {
                        //If no client is registered in localStorage, the user is redirected to the registration page
                        if (Client.getClient() == null) {
                            $location.path('/client');
                        }
                    });
            }
        }
    })
/**
 *  Factory: ProxyEventsHandler
 *  Setup both proxy events listeners and local events emitters
 */
    .factory('ProxyEventsHandler', function ($timeout, Proxy, LocalEventsHandler, Client, Groups) {
        var isPeriodicGroupUpdateEnabled = false;
        return {
            listenForPeriodicGroupsUpdate: function () {
                Proxy.webSocket.on("proxyPeriodicGroupsUpdate", function (groups) {
                    LocalEventsHandler.emitPeriodicGroupsUpdate(groups);
                })
            },
            listenForNewGroupCreated: function () {
                Proxy.webSocket.on("proxyNewGroup", function (group) {
                    LocalEventsHandler.emitNewGroupCreated(group);
                })
            },
            listenForNewTweets: function () {
                Proxy.webSocket.on("proxyNewTweet", function (data) {
                    LocalEventsHandler.emitNewTweet(data);
                })
            },
            listenForLikedTweet: function () {
                //TODO
            },
            emitClient: function () {
                Proxy.webSocket.emit("registerClient", Client.getClient().id);
                console.log("debug", "Registering client " + Client.getClient().id + " to the proxy");
            },
            emitNewGroup: function (newGroup) {
                Proxy.webSocket.emit("registerNewGroup", newGroup);
            },
            emitSubscribeGroup: function (groupId) {
                Proxy.webSocket.emit("subscribeGroup", {
                    clientId: Client.getClient().id,
                    groupId: groupId
                });
            },
            emitUnSubscribeGroup: function (groupId) {
                Proxy.webSocket.emit("unSubscribeClient", {
                    clientId: Client.getClient().id,
                    groupId: groupId
                });
            },
            emitPeriodicGroupUpdate: function (period) {
                if (!isPeriodicGroupUpdateEnabled) {
                    isPeriodicGroupUpdateEnabled = true;
                    var announceGroups = function () {
                        if (angular.isArray(Groups.getGlobalGroups()) && Groups.getGlobalGroups().length != 0) {
                            Proxy.webSocket.emit("periodicGroupsUpdate", Groups.getGlobalGroups());
                        }
                        $timeout(announceGroups, period);
                    }
                    $timeout(announceGroups, period);
                }
            },
            emitNewTweet: function (tweet) {
                Proxy.webSocket.emit("newTweet", tweet);
            }
        }
    })
/**
 *  Factory: LocalEventsHandler
 *  Setup both local events listeners and local events emitters
 */
    .factory('LocalEventsHandler', function ($rootScope, Groups, Client, Tweets) {
        return {
            emitPeriodicGroupsUpdate: function (groups) {
                $rootScope.$emit('localPeriodicGroupsUpdate', groups);
            },
            emitNewGroupCreated: function (group) {
                $rootScope.$emit('localNewGroupCreated', group);
            },
            emitNewTweet: function (data) {
                $rootScope.$emit('localNewTweet', data)
            },
            listenForPeriodicGroupsUpdate: function () {
                $rootScope.$on('localPeriodicGroupsUpdate', function (event, groups) {
                    console.log("debug", "Received groups periodic update ");
                    // Update local storage if group doesn't exist
                    if (groups && angular.isArray(groups)) {
                        var globalGroups = Groups.getGlobalGroups();
                        for (var i = 0, len = groups.length; i < len; i++) {
                            if (!Groups.globalGroupExists(groups[i].id)) {
                                globalGroups.unshift(groups[i]);
                                Groups.setGlobalGroups(globalGroups);
                                $rootScope.$emit('groupsUpdated');
                            }
                        }
                    }
                })
            },
            listenForNewGroupCreated: function () {
                $rootScope.$on('localNewGroupCreated', function (event, group) {
                    console.log("debug", "Received new group " + group.name + " from proxy");
                    Groups.addGlobalGroup(group);
                    $rootScope.$emit('groupsUpdated');
                })
            },
            listenForNewTweets: function () {
                $rootScope.$on('localNewTweet', function (event, newTweet) {
                    console.log("debug", "Received new tweet from " + newTweet.tweet.owner);
                    // Update tweets list for the given group
                    if (!(newTweet.ownerId == Client.getClient().id)) {
                        Tweets.addTweet({
                            owner: newTweet.tweet.owner,
                            content: newTweet.tweet.content,
                            date: newTweet.tweet.date,
                            id: newTweet.tweet.id
                        }, newTweet.groupId);
                    }

                    $rootScope.$emit('tweetsUpdated');
                })
            },
            listenForLikedTweet: function () {
                //TODO
            }
        }
    })
    .factory('Proxy', function ($http, $rootScope, LocalStorage) {
        var socket = {};
        return {
            isConnected: function (onSuccess, onError) {
                $http.get("http://" + $rootScope.proxyAddress + ":3000").then(function (response) {
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
                        socket = io.connect("http://" + $rootScope.proxyAddress + ":3000", {
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
            globalGroupExists: function (groupId) {
                var globalGroups = LocalStorage.getParsed("globalGroups");
                for (var i = 0, len = globalGroups.length; i < len; i++) {
                    if (globalGroups[i].id === groupId) {
                        return true;
                    }
                }
                return false;
            },
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
            getClientGroups: function () {
                return LocalStorage.getParsed("clientGroups");
            },
            getSubscribedGroups: function () {
                return LocalStorage.getParsed("subscribedGroups");
            },
            setGlobalGroups: function (globalGroups) {
                LocalStorage.save("globalGroups", globalGroups);
            },
            setClientGroups: function (clientGroups) {
                LocalStorage.save("clientGroups", clientGroups);
            },
            setSubscribedGroups: function (subscribedGroups) {
                LocalStorage.save("subscribedGroups", subscribedGroups);
            },
            addClientGroup: function (clientGroup) {
                var clientGroups = this.getClientGroups();
                clientGroups.unshift(clientGroup);
                this.setClientGroups(clientGroups);
            },
            addSubscribedGroup: function (subscribedGroup) {
                var subscribedGroups = this.getSubscribedGroups();
                subscribedGroups.unshift(subscribedGroup);
                this.setSubscribedGroups(subscribedGroups);
            },
            addGlobalGroup: function (globalGroup) {
                var globalGroups = this.getGlobalGroups();
                globalGroups.unshift(globalGroup);
                this.setGlobalGroups(globalGroups);
            }
        }
    })
    .factory('Client', function (LocalStorage) {
        return {
            getClient: function () {
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
                    id: tweet.id,
                    liked: 0
                });
            },
            getTweets: function (groupId) {
                checkIfGroupExists(groupId);
                return tweets[groupId].tweets;
            },
            likeTweet: function (groupId, tweetId) {
                if (checkIfGroupExists(groupId)) {
                    for (var i = 0; i < tweets[groupId].tweets.length; i++) {
                        if (tweets[groupId].tweets[i].id == tweetId) {
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
                        deferred.resolve(null);
                        ;
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
                geolocation.watchPosition(this.updatePosition, function () {
                }, options);
            }
        }
    })
    .factory('Camera', function ($window) {
        var camera = $window.navigator.camera;
        var cameraOptions = {quality: pictureQuality,
            destinationType: Camera.DestinationType.DATA_URL, sourceType: Camera.PictureSourceType.CAMERA,
            targetWidth: 507, targetHeight: 337};

        return {
            takeMobilePicture: function (pictureQuality) {
                camera.getPicture(function (imageData) {
//                    handle base64 image here
                }, function (error) {
                    console.log('error', 'Error while taking picture ' + error);
                }, cameraOptions);
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
            clear: function () {
                localStorage.clear();
            }
        };
    });