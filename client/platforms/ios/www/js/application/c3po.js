angular.module('c3po', ['ui.bootstrap', 'ui.router', 'ngAnimate', 'ngTouch'])
   .config(function ($stateProvider, $urlRouterProvider) {
      $urlRouterProvider.otherwise('/client');
      $stateProvider
         .state('client', {
            url: '/client',
            templateUrl: 'templates/client.html',
            controller: 'clientCtrl'
         })
         .state('map', {
            url: '/carte',
            templateUrl: 'templates/map.html',
            controller: 'mapCtrl'
         })
         .state('groups', {
            url: '/groupes',
            templateUrl: 'templates/groups.html',
            controller: 'groupsCtrl'
         })
         .state('addGroup', {
            url: '/groupes/ajout',
            templateUrl: 'templates/groups/add-group.html',
            controller: 'groupsAddCtrl'
         })
         .state('group', {
            url: '/groupes/{id}',
            templateUrl: 'templates/groups/group.html',
            controller: 'groupCtrl'
         });
   })
   .run(function ($rootScope, $location, Groups, Client, Proxy, Geolocation) {
      //Globals
      $rootScope.eventAlreadyRegistered = false;
      $rootScope.proxyOnline = false;
      $rootScope.groupsEventsRegistered = false;

      var setUpLocalStorage = function () {
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
      }

      var setUpProxy = function () {
         Proxy.webSocket.connect(function () {
            Proxy.webSocket.on('connect', function () {
               $rootScope.proxyOnline = true;
               if (Client.getClient() != null) {
                  Proxy.webSocket.emit("registerUser", Client.getClient().id);
               }
            });
            Proxy.webSocket.on('disconnect', function () {
               $rootScope.proxyOnline = false;
               console.log("Proxy went offline");
            });
         }, function () {
            $rootScope.proxyOnline = false;
            console.log("Error while trying to connect to Proxy");
         });
      }

      var setUpApplication = function () {
         // Set up a watcher for client's localisation change. This way, client's position will be always available without waiting
         Geolocation.watchPosition();
      }

      setUpLocalStorage();
      setUpProxy();
      setUpApplication();

      $rootScope.$on("$stateChangeSuccess",
         function (event, toState, toParams,
            fromState, fromParams) {
            //If no client is registered in localStorage, the user is redirected to the registration page
            if (Client.getClient() == null) {
               $location.path('/client');
            }
         });
   });