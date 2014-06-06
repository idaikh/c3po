angular.module('c3po', ['ui.bootstrap', 'ui.router', 'ngAnimate', 'ngTouch'])
    .config(function ($stateProvider, $urlRouterProvider) {
        $urlRouterProvider.otherwise('/groupes');
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
    .run(function ($rootScope, C3poApp) {
        /**
         *  If devMode is set to true, local storage will be cleared at application startup (useful if an
         *  update is made by a developer to prevent application from crashing)
         */
        $rootScope.devMode=true;

        /*  Use localhost for local test if a local proxy is running. Don't forget to change the address in socket.io
            src import in index.html */
        $rootScope.proxyAddress="http://localhost:3000";

        /**
         *  Initialize C3PO application, register distant (from Proxy) events listeners
         */
        C3poApp.bootstrap();

        /**
         *  Registering local events listeners/emitters, route watcher on url change.
         */
            //
        C3poApp.configure();
    });