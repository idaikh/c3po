angular.module('c3po')
    .directive("mapC3po", function () {
        return {
            restrict: "E",
            scope: {},
            templateUrl: "templates/directive-templates/dir-map.html",
            controller: function ($scope, $element, $attrs, Geolocation) {

                google.maps.event.addDomListener(window, 'load', geolocateClient());

                function geolocateClient() {
                    Geolocation.getWatchedPosition().then(function (position) {
                        mapInitialize(position);
                    }, function () {
                        console.log('error', 'Unable to determine client position');
                    });
                }

                function mapInitialize(position) {
                    var myPosition = new google.maps.LatLng(position.latitude, position.longitude);
                    var mapOptions = {
                        center: myPosition,
                        zoom: 18,
                        mapTypeId: google.maps.MapTypeId.ROADMAP
                    };
                    var map = new google.maps.Map(document.getElementById("dir-map"),
                        mapOptions);

                    var marker = new google.maps.Marker({
                        position: myPosition,
                        map: map,
                        title: 'Votre position'
                    });

                    // Stop the side bar from dragging when mousedown/tapdown on the map
                    google.maps.event.addDomListener(document.getElementById('dir-map'), 'mousedown', function (e) {
                        e.preventDefault();
                        return false;
                    });
                }

            },
            link: function (scope, element, attrs) {
            }
        }
    })
    .directive("groupC3po", function () {
        return {
            restrict: "E",
            scope: {
                group:"=",
                subscribe:"&",
                unsubscribe:"&"
            },
            templateUrl: "templates/directive-templates/dir-group.html",
            controller: function ($scope, $element, $attrs,Groups,Client) {
                $scope.isGroupOwner = function (groupOwnerId) {
                    return Client.getClient().id == groupOwnerId ? true : false;
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
            },
            link: function(scope,element,attrs) {
//                var elementHeight=element.height();
//                var group=$(element).find('.group');
//                var groupThumbnail=group.find('.group-thumbnail');
//                var groupThumbnailImg=group.find('.group-thumbnail img');
//                var groupContent=group.find('.group-content');
//
//                group.height(elementHeight);
//                var groupHeight=group.height();
//
//                groupThumbnail.height(groupHeight);
//                groupThumbnailImg.height(groupHeight-10);
//                groupContent.height(groupHeight);
            }
        }
    });