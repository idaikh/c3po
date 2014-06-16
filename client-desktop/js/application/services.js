angular.module('c3po-desktop')
/**
 *  Factory: C3poApp
 *  Application bootstrap/setup factory
 */
    .factory('C3poApp', function ($rootScope, $location, LocalStorage, Groups, Proxy, Client, Geolocation, ProxyEventsHandler, LocalEventsHandler, Logger) {
        return {
            bootstrap: function () {
                //Globals
                $rootScope.proxyOnline = false;

                if ($rootScope.devMode) {
                    /* Clear local storage if devMode is set to true */
                    LocalStorage.clear();
                }

                /**
                 *  Set up local Storage items. If an item is not present, defines it with an empty array
                 */
                (function setUpLocalStorage() {
                    var clientGroups = Groups.client.getGroups();
                    var subscribedGroups = Groups.subscribed.getGroups();
                    var globalGroups = Groups.global.getGroups();

                    if (clientGroups === null || clientGroups === "") {
                        Groups.client.setGroups([]);
                    }

                    if (subscribedGroups === null || subscribedGroups === "") {
                        Groups.subscribed.setGroups([]);
                    }

                    if (globalGroups === null || globalGroups === "") {
                        Groups.global.setGroups([]);
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

                            /* Enabling listeners/emitters for proxy events */
                            ProxyEventsHandler.listenForPeriodicGroupsUpdate();
                            ProxyEventsHandler.listenForNewGroupCreated();
                            ProxyEventsHandler.listenForGroupUpdateParticipants();
                            ProxyEventsHandler.listenForNewTweets();
                            ProxyEventsHandler.listenForCloseGroup();
                            ProxyEventsHandler.emitPeriodicGroupUpdate(10000, 5);

                            if (Client.getClient() != null) {
                                /* Registering client to the proxy if a client item is found on the local storage.
                                 This will cause a socket update on the proxy (if the client hasn't launched the application
                                 for a long time the socket will be closed by the proxy, we have to re enable it) */
                                ProxyEventsHandler.emitClient();
                            }

                        });
                        Proxy.webSocket.on('disconnect', function () {
                            $rootScope.proxyOnline = false;
                            Logger.log("Proxy is offline");
                        });
                    }, function () {
                        $rootScope.proxyOnline = false;
                        Logger.log("Error while trying to connect to proxy");
                    });
                })();
            },
            configure: function () {
                /**
                 *  Set up a watcher on client localisation change. Client position can be then retrieved without
                 *  waiting time.
                 */
                (function startPositionWatcher() {
                    Geolocation.watchPosition();
                })();

                /* Set up an event listener on url location change. Checks on every url location change if the client
                 localStorage stills exist, if so redirects the user to the registration page. This situation can
                 occur if the client has cleared his browser local storage. */
                $rootScope.$on("$stateChangeSuccess",
                    function (event, toState, toParams, fromState, fromParams) {
                        // If no client is registered in localStorage, the user is redirected to the registration page
                        if (Client.getClient() == null) {
                            $location.path('/welcome');
                        }
                        // If the user tries to go the registration page while he's already registered redirect him to the groups page
                        if (toState.name === "welcome" && Client.getClient() != null) {
                            $location.path('/c3po/groups/list');
                        }
                    });
            }
        }
    })
/**
 *  Factory: Proxy
 *  Handle proxy connection and provide methods (emit/on) to handle proxy events
 */
    .factory('Proxy', function ($http, $rootScope, Logger, Client) {
        var socket = {};
        return {
            isConnected: function (onSuccess, onError) {
                $http.get($rootScope.proxyAddress).then(function (response) {
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
                        // Intercept events only if user is registered
                        if (Client.getClient() != null) {
                            var args = arguments;
                            $rootScope.$apply(function () {
                                callback.apply(socket, args);
                            });
                        }
                    });
                },
                emit: function (eventName, args) {
                    socket.emit(eventName, args);
                },
                connect: function (onSuccess, onError) {
                    try {
                        socket = io.connect($rootScope.proxyAddress, {
                            'reconnection delay': 1000, // defaults to 500
                            'reconnection limit': 100, // defaults to Infinity
                            'max reconnection attempts': Infinity // defaults to 10
                        });
                        onSuccess(socket);
                    } catch (e) {
                        Logger.log(e);
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
/**
 *  Factory: ProxyEventsHandler
 *  Setup both proxy events listeners and local events emitters
 */
    .factory('ProxyEventsHandler', function ($timeout, Proxy, LocalEventsHandler, Client, Groups, Logger, Tweets, Notifications) {
        var emitterAlreadyDefined = false;
        return {
            listenForPeriodicGroupsUpdate: function () {
                Proxy.webSocket.on("proxyPeriodicGroupsUpdate", function (groups) {
                    // Update local storage if group doesn't exist
                    Logger.log("(Received) Periodic group update with " + groups.length + " groups from the proxy");
                    if (groups && angular.isArray(groups)) {
                        var globalGroups = Groups.global.getGroups();
                        for (var i = 0, len = groups.length; i < len; i++) {
                            if (!Groups.global.groupExists(groups[i].id)) {
                                Groups.global.addGroup(groups[i]);
                            }
                        }
                    }
                })
            },
            listenForNewGroupCreated: function () {
                Proxy.webSocket.on("proxyNewGroup", function (group) {
                    Logger.log("(Received) Received new group " + group.id + " from the proxy");
                    Groups.global.addGroup(group);
                    Notifications.newGroup(group);
                })
            },
            listenForCloseGroup: function () {
                Proxy.webSocket.on("closeGroup", function (groupId) {
                    Groups.updateGroupStatus(groupId);
                    Logger.log("(Received) Received close group " + groupId + " from the proxy");
                })
            },
            listenForNewTweets: function () {
                Proxy.webSocket.on("proxyNewTweet", function (newTweet) {
                    Tweets.addTweet({
                        owner: newTweet.tweet.owner,
                        content: newTweet.tweet.content,
                        date: newTweet.tweet.date,
                        attachment: newTweet.tweet.attachment,
                        id: newTweet.tweet.id
                    }, newTweet.groupId);
                })
            },
            listenForGroupUpdateParticipants: function () {
                Proxy.webSocket.on("updateGroupParticipants", function (groupParticipants) {
                    Logger.log("(Received) Received group update participants " + groupParticipants.participants + " for group " + groupParticipants.groupId + " from the proxy");
                    Groups.updateGroupParticipants(groupParticipants.groupId, groupParticipants.participants);
                })
            },
            emitClient: function () {
                Proxy.webSocket.emit("registerClient", Client.getClient().id);
                Logger.log("(Emit) Registering client " + Client.getClient().id + " to the proxy");
            },
            emitNewGroup: function (newGroup) {
                Proxy.webSocket.emit("registerNewGroup", newGroup);
                Logger.log("(Emit) Registering new group " + newGroup.id + " to the proxy");
            },
            emitSubscribeGroup: function (groupId) {
                Proxy.webSocket.emit("subscribeGroup", {
                    clientId: Client.getClient().id,
                    groupId: groupId
                });
                Logger.log("(Emit) Subscribing to group " + groupId + " to the proxy");
            },
            emitUnSubscribeGroup: function (groupId) {
                Proxy.webSocket.emit("unSubscribeClient", {
                    clientId: Client.getClient().id,
                    groupId: groupId
                });
                Logger.log("(Emit) Unsubscribing from group " + groupId + " to the proxy");
            },
            emitPeriodicGroupUpdate: function (period, nbOfGroups) {
                if (!emitterAlreadyDefined) {
                    emitterAlreadyDefined = true;
                    var announceGroups = function () {
                        var globalGroups = Groups.global.getGroups();
                        if (angular.isArray(globalGroups) && globalGroups.length != 0) {
                            var groupsToSend;
                            if (nbOfGroups > globalGroups.length) {
                                groupsToSend = globalGroups;
                            } else {
                                groupsToSend = globalGroups.splice(0, nbOfGroups);
                            }
                            Proxy.webSocket.emit("periodicGroupsUpdate", groupsToSend);
                            Logger.log("(Emit) Periodic group update with " + groupsToSend.length + " groups to the proxy");
                        }
                        $timeout(announceGroups, period);
                    }
                    $timeout(announceGroups, period);
                }
            },
            emitNewTweet: function (tweet) {
                Proxy.webSocket.emit("newTweet", tweet);
                Logger.log("(Emit) New tweet by " + tweet.ownerId + " in group " + tweet.groupId + " to the proxy");
            },
            emitCloseGroup: function (groupId) {
                Proxy.webSocket.emit("closeGroup", groupId);
                Logger.log("(Emit) Close group " + groupId + " to the proxy");
            }
        }
    })
/**
 *  Factory: LocalEventsHandler
 *  Setup both local events listeners and local events emitters
 */
    .factory('LocalEventsHandler', function ($rootScope, Groups, Client, Tweets) {
        return {
            emitUpdateMapView: function (mapData) {
                $rootScope.$emit('updateMapView', mapData);
            },
            emitMapUserPosition: function () {
                $rootScope.$emit('mapUserPosition');
            }
        }
    })
/**
 *  Factory: Groups
 *  Provides methods to manage groups
 */
    // TODO: Could be refactored to prevent code duplication
    .factory('Groups', function ($filter, LocalStorage, Client, Map, Logger) {
        return {
            updateGroupParticipants: function (groupIdParam, nbParticipantsParam) {
                var globalGroups = this.global.getGroups();

                for (var i = 0, len = globalGroups.length; i < len; i++) {
                    if (globalGroups[i].id === groupIdParam) {
                        globalGroups[i].nbParticipants = nbParticipantsParam;
                        // Erase group from list as they are no more subscribed users to it
                        if(!globalGroups[i].groupActive&&globalGroups[i].nbParticipants==1) {
                            globalGroups.splice(i,1);
                        }
                        this.global.setGroups(globalGroups);
                        break;
                    }
                }
            },
            updateGroupStatus: function (groupId) {
                var globalGroups = this.global.getGroups();
                var clientGroups = this.client.getGroups();

                // Update global group status
                if (globalGroups != null && angular.isArray(globalGroups)) {
                    for (var i = 0, len = globalGroups.length; i < len; i++) {
                        if (globalGroups[i].id === groupId) {
                            globalGroups[i].groupActive = false;
                            if(globalGroups[i].nbParticipants==1) {
                                globalGroups.splice(i,1);
                            }
                            this.global.setGroups(globalGroups);
                            break;
                        }
                    }
                }

                // Remove group from client own groups
                if (clientGroups != null && angular.isArray(clientGroups)) {
                    for (var i = 0, len = clientGroups.length; i < len; i++) {
                        if (clientGroups[i].id === groupId) {
                            clientGroups.splice(i,1);
                            this.client.setGroups(clientGroups);
                            break;
                        }
                    }
                }
            },
            updateGroupPositions: function () {
                var globalGroups = this.global.getGroups();
                var that = this;

                if (globalGroups != null && angular.isArray(globalGroups)) {
                    for (var i = 0, len = globalGroups.length; i < len; i++) {
                        (function () {
                            var index = i;
                            Map.computeDistanceFromClient(globalGroups[index].address).then(function (distance) {
                                var distanceFromUser = $filter('number')(distance, 2);
                                that.global.updateGroupDistance(globalGroups[index].id, distanceFromUser);
                            }, function (distance) {
                                // Could not determine distance from user - distance equal 0
                                var distanceFromUser = distance;
                                that.global.updateGroupDistance(globalGroups[index].id, distanceFromUser);
                            });
                        }());
                    }
                }
            },
            isGroupOwner: function (groupId) {
                var globalGroups = this.global.getGroups();
                var clientId = Client.getClient().id;

                if (globalGroups != null && angular.isArray(globalGroups)) {
                    for (var i = 0, len = globalGroups.length; i < len; i++) {
                        if (globalGroups[i].id === groupId) {
                            // Check if user is the owner of the group
                            return globalGroups[i].ownerId == clientId ? true : false;
                        }
                    }
                    return false;
                } else {
                    return false;
                }
            },
            isSubscribedToGroup: function (groupId) {
                var subscribedGroups = this.subscribed.getGroups();
                if (subscribedGroups != null && angular.isArray(subscribedGroups)) {
                    for (var i = 0, len = subscribedGroups.length; i < len; i++) {
                        if (subscribedGroups[i].id === groupId) {
                            return true
                        }
                    }
                    return false;
                } else {
                    return false;
                }
            },
            subscribeGroup: function (groupId) {
                var globalGroups = this.global.getGroups();

                if (globalGroups != null && angular.isArray(globalGroups)) {
                    for (var i = 0, len = globalGroups.length; i < len; i++) {
                        if (globalGroups[i].id === groupId) {
                            // Update subscribed groups local storage
                            this.subscribed.addGroup({id: globalGroups[i].id, name: globalGroups[i].name})
                        }
                    }
                } else {
                    Logger.log("Could not subscribe to group " + groupId);
                }
            },
            unSubscribeGroup: function (groupId) {
                var subscribedGroups = this.subscribed.getGroups();
                if (subscribedGroups != null && angular.isArray(subscribedGroups)) {
                    for (var i = 0, len = subscribedGroups.length; i < len; i++) {
                        if (subscribedGroups[i].id === groupId) {
                            this.subscribed.removeGroupByIndex(i);
                            break;
                        }
                    }
                } else {
                    Logger.log("Could not unsubscribe from group " + groupId);
                }
            },
            global: {
                addGroup: function (group) {
                    var client = Client.getClient();
                    var groups = this.getGroups();
                    var that = this;

                    groups.unshift(group);
                    that.setGroups(groups);
                    Client.addGroupPseudo(group.id, client.pseudo);

                    Map.computeDistanceFromClient(group.address).then(function (distance) {
                        var distanceFromUser = $filter('number')(distance, 1);
                        that.updateGroupDistance(group.id, distanceFromUser);
                    }, function (distance) {
                        // Could not determine distance from user - distance equal 0
                        var distanceFromUser = distance;
                        that.updateGroupDistance(group.id, distanceFromUser);
                    });
                },
                updateGroupDistance: function (groupId, distance) {
                    var groups = this.getGroups();
                    if (angular.isArray(groups)) {
                        for (var i = 0, len = groups.length; i < len; i++) {
                            if (groups[i].id === groupId) {
                                groups[i].distanceFromUser = distance;
                                this.setGroups(groups);
                            }
                        }
                    }
                },
                getGroups: function () {
                    return LocalStorage.getParsed("globalGroups");
                },
                getSingleGroup: function (groupId) {
                    var groups = this.getGroups();
                    if (angular.isArray(groups)) {
                        for (var i = 0, len = groups.length; i < len; i++) {
                            if (groups[i].id === groupId) {
                                return groups[i];
                            }
                        }
                    }
                    return null;
                },
                setGroups: function (groups) {
                    LocalStorage.save("globalGroups", groups);
                },
                groupExists: function (groupId) {
                    var groups = this.getGroups();
                    if (angular.isArray(groups)) {
                        for (var i = 0, len = groups.length; i < len; i++) {
                            if (groups[i].id === groupId) {
                                return true;
                            }
                        }
                    }
                    return false;
                }
            },
            client: {
                addGroup: function (group) {
                    var groups = this.getGroups();
                    groups.unshift(group);
                    this.setGroups(groups);
                },
                getGroups: function () {
                    return LocalStorage.getParsed("clientGroups");
                },
                setGroups: function (groups) {
                    LocalStorage.save("clientGroups", groups);
                }
            },
            subscribed: {
                addGroup: function (group) {
                    var groups = this.getGroups();
                    groups.unshift(group);
                    this.setGroups(groups);
                },
                getGroups: function () {
                    return LocalStorage.getParsed("subscribedGroups");
                },
                setGroups: function (groups) {
                    LocalStorage.save("subscribedGroups", groups);
                },
                removeGroupByIndex: function (index) {
                    var subscribedGroups = this.getGroups();
                    subscribedGroups.splice(index, 1);
                    this.setGroups(subscribedGroups);
                }
            }
        }
    })
/**
 *  Factory: Client
 *  Provides methods to manage user in local storage
 */
    .factory('Client', function (LocalStorage) {
        return {
            getClient: function () {
                return LocalStorage.getParsed("client");
            },
            getGroupPseudos: function (groupId) {
                var client = LocalStorage.getParsed("client");
                for (var i = 0, len = client.groupPseudos.length; i < len; i++) {
                    if (client.groupPseudos[i].id == groupId) {
                        return client.groupPseudos[i].pseudos;
                    }
                }
                return [];
            },
            addGroupPseudo: function (groupId, pseudo) {
                var client = LocalStorage.getParsed("client");

                // Check if a groupId is defined in groupPseudos, if so we push a new pseudo to this group
                for (var i = 0, len = client.groupPseudos.length; i < len; i++) {
                    if (client.groupPseudos[i].id == groupId) {
                        client.groupPseudos[i].pseudos.push(pseudo);
                        this.saveClient(client);
                        return;
                    }
                }

                // If no groupId has been found, create a new groupPseudo
                var groupPseudo = {
                    id: groupId,
                    pseudos: [client.pseudo]
                };
                client.groupPseudos.push(groupPseudo);
                this.saveClient(client);
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
                var newTweet = {
                    owner: tweet.owner,
                    content: tweet.content,
                    date: tweet.date,
                    id: tweet.id,
                    liked: 0
                };
                if (tweet.attachment != "" && tweet.attachment != null && tweet.attachment != 'undefined') {
                    newTweet.attachment = tweet.attachment;
                }
                tweets[groupId]["tweets"].unshift(newTweet);
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
    .factory('Map', function ($q, $window) {
        var geolocation = $window.navigator.geolocation;
        var options = {
            maximumAge: 10000,
            timeout: 60000,
            enableHighAccuracy: true
        };

        return {
            computeDistanceFromClient: function (groupPos) {
                var deferred = $q.defer();
                var promise = deferred.promise;

                if (angular.isDefined(google)) {
                    geolocation.getCurrentPosition(function (clientPosition) {
                        var groupLatLong = new google.maps.LatLng(groupPos.latitude, groupPos.longitude);
                        var clientLatLong = new google.maps.LatLng(clientPosition.coords.latitude, clientPosition.coords.longitude);
                        var distance = google.maps.geometry.spherical.computeDistanceBetween(clientLatLong, groupLatLong);
                        deferred.resolve(distance / 1000);
                    }, function () {
                    }, options);
                }
                return promise;
            }
        }
    })
    .factory('Geolocation', function ($window, $q, Groups) {
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

                // Trigger group positions update on client location change
                Groups.updateGroupPositions();
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
    })
    .factory('FileReader', function ($q, Logger) {

        var resizeAttachment = function (reader) {
            var deferred = $q.defer();

            var tempImg = new Image();
            tempImg.src = reader.result;
            tempImg.onload = function () {
                var MAX_WIDTH = 200;
                var MAX_HEIGHT = 127;
                var tempW = tempImg.width;
                var tempH = tempImg.height;
                if (tempW > tempH) {
                    if (tempW > MAX_WIDTH) {
                        tempH *= MAX_WIDTH / tempW;
                        tempW = MAX_WIDTH;
                    }
                } else {
                    if (tempH > MAX_HEIGHT) {
                        tempW *= MAX_HEIGHT / tempH;
                        tempH = MAX_HEIGHT;
                    }
                }
                var canvas = document.createElement('canvas');
                canvas.width = tempW;
                canvas.height = tempH;
                var ctx = canvas.getContext("2d");
                ctx.drawImage(this, 0, 0, tempW, tempH);
                var dataURL = canvas.toDataURL("image/jpeg");
                deferred.resolve(dataURL);
            }
            return deferred.promise;
        }

        var onLoad = function (reader, deferred, scope) {
            return function () {
                scope.$apply(function () {
                    resizeAttachment(reader).then(function (data) {
                        deferred.resolve(data);
                    })
                });
            };
        };

        var onError = function (reader, deferred, scope) {
            return function () {
                scope.$apply(function () {
                    resizeAttachment(reader).then(function (data) {
                        deferred.reject(data);
                    })
                });
            };
        };

        var getReader = function (deferred, scope) {
            var reader = new FileReader();
            reader.onloadend = onLoad(reader, deferred, scope);
            reader.onerror = onError(reader, deferred, scope);
            return reader;
        };

        var readAsDataURL = function (file, scope) {
            var deferred = $q.defer();

            var reader = getReader(deferred, scope);
            try {
                reader.readAsDataURL(file);
            } catch (e) {
                Logger.log(e);
            }

            return deferred.promise;
        };

        return {
            readAsDataUrl: readAsDataURL
        };
    })
    .factory("Notifications", function ($filter) {
        var notifications = [];
        return {
            newGroup: function (group) {
                var date = new Date();
                date = $filter('date')(date, "dd/MM/yyyy HH:mm");
                notifications.push(date + ' :: Création d\'un nouveau groupe ' + group.name + ' par ' + group.ownerPseudo);
            },
            getNotifications: function () {
                return notifications;
            },
            removeNotification: function (notif) {
                var index = notifications.indexOf(notif);
                if (index != -1) {
                    notifications.splice(index, 1);
                }
            }
        }
    })
    .factory('Logger', function ($filter) {
        var loggedMsg = [];
        return {
            log: function (msg) {
                var date = new Date();
                date = $filter('date')(date, "Le dd/MM/yyyy à HH:mm");
                loggedMsg.push(date + ' :: ' + msg);
                console.log(date + ' :: ' + msg);
            }
        };
    });