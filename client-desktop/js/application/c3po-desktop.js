angular.module('c3po-desktop', ['ui.bootstrap','ui.router', 'ngAnimate', 'ngTouch'])
    .config(function ($stateProvider, $urlRouterProvider) {
        $urlRouterProvider.otherwise('/welcome');
        $stateProvider
            .state('welcome', {
                url: '/welcome',
                templateUrl: 'templates/welcome.html',
                controller: 'welcomeCtrl'
            })
            .state('c3po', {
                url: '/c3po',
                abstract: true,
                templateUrl: 'templates/main.html',
                controller: 'mainCtrl'
            })
            .state('c3po.groups', {
                url: '/groups',
                views: {
                    'mainView': {
                        templateUrl: 'templates/groups.html',
                        controller: 'groupsCtrl'
                    }
                }
            })
            .state('c3po.client', {
                url: '/client',
                views: {
                    'mainView': {
                        templateUrl: 'templates/client.html',
                        controller: 'clientCtrl'
                    }
                }
            })
            .state('c3po.groups.list', {
                url: '/list',
                views: {
                    'groupsView': {
                        templateUrl: 'templates/groups/groups-list.html',
                        controller:'listGroupsCtrl'
                    }
                }
            })
            .state('c3po.groups.add', {
                url: '/add',
                views: {
                    'groupsView': {
                        templateUrl: 'templates/groups/groups-add.html',
                        controller: 'addGroupCtrl'
                    }
                }
            })
            .state('c3po.groups.group', {
                url: '/group/{groupId}',
                views: {
                    'groupsView': {
                        templateUrl: 'templates/groups/group.html',
                        controller: 'groupCtrl'
                    }
                }
            })
    })
    .run(function ($rootScope, C3poApp) {
        /*  If devMode is set to true, local storage will be cleared at application startup (useful if an update is made
         by a developer to prevent application from crashing)    */
        $rootScope.devMode = false;

        /*  Use localhost for local test if a local proxy is running. Don't forget to change the address in socket.io
         src import in index.html */
        $rootScope.proxyAddress = "http://localhost:3000";


        /*  Initialize C3PO application, register distant (from Proxy) events listeners */
        C3poApp.bootstrap();

        /*  Registering local events listeners/emitters, route watcher on url change */
        C3poApp.configure();
    });