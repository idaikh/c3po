angular.module('c3po-desktop', ['ui.router', 'ngAnimate', 'ngTouch'])
    .config(function ($urlRouterProvider) {
        $urlRouterProvider.otherwise('/');
    })
    .run(function ($rootScope) {

    });