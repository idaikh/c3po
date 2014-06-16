angular.module('c3po-desktop')
    .directive('attachmentTrigger', function () {
        return function (scope, element, attrs) {
            element.bind("click", function (event) {
                var attachmentInput = angular.element("#attachmentInput");
                attachmentInput.trigger('click');
            });
        };
    })
    .directive("ngFileSelect", function () {
        return {
            link: function ($scope, element) {
                element.bind("change", function (e) {
                    $scope.file = (e.srcElement || e.target).files[0];
                    $scope.getAttachment($scope.file);
                })
            }
        }
    })
    .directive('ngEnter', function () {
        return function (scope, element, attrs) {
            element.bind("keydown keypress", function (event) {
                if (event.which === 13) {
                    scope.$apply(function () {
                        scope.$eval(attrs.ngEnter);
                    });
                    event.preventDefault();
                }
            });
        };
    })
    .directive('mainPageC3po', function () {
        return {
            restrict: "E",
            transclude: true,
            template: "<div class='page' ng-transclude></div>",
            link: function (scope, element, attrs) {
                var header = angular.element('.header');
                var page = angular.element('.page');
                if (header.offset().top < 30) {
                    page.offset({top: 30, left: 0});
                } else {
                    page.offset({top: 0, left: 0});
                }
            }
        };
    })
    .directive('offcanvasC3po', function () {
        return {
            restrict: "A",
            link: function (scope, element, attrs) {
                var offcanvas = angular.element('.offcanvas-c3po');
                var offcanvasLinks = angular.element('.offcanvas-c3po a');
                var page = angular.element('.page');
                element.on('click', function () {
                    if (offcanvas.offset().left == -200) {
                        // Offcanvas is closed then we open it
                        offcanvas.animate({left: 0}, 500);
//                        page.animate({left: 300}, 500);
                    } else {
                        // Offcanvas is opened then we close it
                        offcanvas.animate({left: -200}, 500);
//                        page.animate({left: 0}, 500);
                    }
                });

                offcanvasLinks.on('click', function () {
                    // Close offcanvas when a link is clicked
                    offcanvas.animate({left: -200}, 500);
//                    page.animate({left: 0}, 500);
                });
            }
        };
    })
    .directive("mapC3po", function () {
        return {
            restrict: "E",
            scope: {
                loader:"="
            },
            templateUrl: "templates/directives/map.html",
            controller: function ($scope, $element, $attrs, $rootScope, Geolocation, Groups, Logger, Client) {
                var markers = new Array();
                var map, marker, infowindow,userPosition;

                $scope.loader=true;

                $scope.client=Client.getClient();

                google.maps.event.addDomListener(window, 'load', geolocateClient());

                function geolocateClient() {
                    Geolocation.getWatchedPosition().then(function (position) {
                        mapInitialize(position);
                    }, function () {
                        Logger.log('Could not retrieve client position');
                    });
                }

                // Check if the marker corresponding to the group exists
                function markerExist(group) {
                    if (angular.isArray(markers)) {
                        for (var i = 0, lenMarkers = markers.length; i < lenMarkers; i++) {
                            // If the marker exists, update marker participants
                            if (group.id == markers[i].groupId) {
                                markers[i].participants = group.nbParticipants;
                                return true;
                            }
                        }
                        return false;
                    }
                }

                function mapInitialize(position) {
                    if (angular.isDefined(position)) {
                        var myPosition = new google.maps.LatLng(position.latitude, position.longitude);
                    } else {
                        // Random position if client position cannot be determined
                        var myPosition = new google.maps.LatLng(50.6371834, 3.063017400000035);
                    }
                    var mapOptions = {
                        center: myPosition,
                        zoom: 12,
                        mapTypeControl: false,
                        streetViewControl: false,
                        scaleControl: false,
                        panControl: false,
                        zoomControlOptions: {
                            style: google.maps.ZoomControlStyle.SMALL,
                            position: google.maps.ControlPosition.TOP_RIGHT
                        },
                        mapTypeId: google.maps.MapTypeId.ROADMAP
                    };

                    try {
                        if (Client.getClient() != null) {
                            map = new google.maps.Map(document.getElementById("map"), mapOptions);
                        }
                    } catch (e) {
                        Logger.log(e);
                    }

                    infowindow = new google.maps.InfoWindow({
                        content: ''
                    });

                    (function addUserPosition() {
                        userPosition = new google.maps.Marker({
                            position: myPosition,
                            map: map,
                            animation: google.maps.Animation.DROP,
                            icon: 'img/blue_dot_circle.png',
                            title: 'Votre position',
                            visible: true
                        });
                        if(angular.isDefined($scope.client)){
                            infowindow.setContent("<p class='info-window-title text-primary'><i class='icon-user-1 sm-margin-right'></i>" +$scope.client.pseudo+"</p>");
                            infowindow.open(map, userPosition);
                        }
                    })();

                    function updateMarkers(groups) {
                        if (angular.isArray(groups)) {
                            for (var i = 0, len = groups.length; i < len; i++) {
                                // Update markers only if marker doesn't exist
                                if (!markerExist(groups[i])) {
                                    marker = new google.maps.Marker({
                                        position: new google.maps.LatLng(groups[i].address.latitude, groups[i].address.longitude),
                                        map: map,
                                        animation: google.maps.Animation.DROP,
                                        title: groups[i].name,
                                        visible: true,
                                        groupId: groups[i].id,
                                        owner: groups[i].ownerPseudo,
                                        fullAddress: groups[i].address.fullAddress,
                                        description: groups[i].description,
                                        participants: groups[i].nbParticipants
                                    });
                                    markers.push(marker);
                                    google.maps.event.addListener(marker, 'click', function (e) {
                                        map.setZoom(16);
                                        map.setCenter(this.getPosition());
                                    });
                                    google.maps.event.addListener(marker, 'mouseover', function (e) {
                                        infowindow.setContent("<div class='info-window '><span class='info-window-title text-danger'>" +
                                            this.getTitle() + "</span>" + "<hr/>" + "<p>Créateur: " + "<span class='text-success'>" +
                                            this.owner + "</span>" + "</p>" + "<p>Description: " +
                                            "<span class='text-primary'>" + this.description + "</span>" +
                                            "</p>" + "<p><span class='text-primary'>" + this.participants + "</span> abonné(s)</p></div>");
                                        infowindow.open(map, this);
                                    });
                                }
                            }
                        }
                    }

                    // Set up a watcher on global groups for change to update the map with new markers
                    $scope.$watch(function () {
                        return Groups.global.getGroups();
                    }, function (groups) {
                        updateMarkers(groups);
                    }, true);

                    // Update map view when an 'updateMapView' event is received
                    $rootScope.$on('mapUserPosition', function (event) {
                        // If an info window is opened close it before
                        infowindow.close();
                        map.setCenter(userPosition.getPosition());
                        map.setZoom(16);
                        infowindow.setContent("<p class='info-window-title text-primary'><i class='icon-user-1 sm-margin-right'></i>" +$scope.client.pseudo+"</p>");
                        infowindow.open(map, userPosition);
                    });

                    // Update map view when an 'updateMapView' event is received
                    $rootScope.$on('updateMapView', function (event, data) {
                        // If an info window is opened close it before
                        infowindow.close();
                        // Call explicitly updateMarkers as the event is triggered before the watcher sees any change on groups list
                        updateMarkers(Groups.global.getGroups());
                        map.setCenter(new google.maps.LatLng(data.position.latitude, data.position.longitude));
                        map.setZoom(16);
                        if (angular.isArray(markers)) {
                            for (var i = 0, lenMarkers = markers.length; i < lenMarkers; i++) {
                                if (data.groupId == markers[i].groupId) {
                                    infowindow.setContent("<div class='info-window '><span class='info-window-title text-danger'>" +
                                        markers[i].getTitle() + "</span>" + "<hr/>" + "<p>Créateur: " + "<span class='text-success'>" +
                                        markers[i].owner + "</span>" + "</p>" + "<p>Description: " +
                                        "<span class='text-primary'>" + markers[i].description + "</span>" +
                                        "</p>" + "<p><span class='text-primary'>" + markers[i].participants + "</span> abonné(s)</p></div>");
                                    infowindow.open(map, markers[i]);
                                }
                            }
                        }
                    });

                    // Stop the side bar from dragging when mousedown/tapdown on the map
                    if (Client.getClient() != null) {
                        google.maps.event.addDomListener(document.getElementById('map'), 'mousedown', function (e) {
                            e.preventDefault();
                            return false;
                        });
                    }

                    $scope.loader=false;
                }
            },
            link: function (scope, element, attrs) {
            }
        }
    });