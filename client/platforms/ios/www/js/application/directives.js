angular.module('c3po')
   .directive("test", function () {
      return function (scope, element, attrs) {
         var div=$("#footer .container-fluid");
         var test=element.next();
         
         console.log(test);
         $("#footer .container-fluid").append( $("#yes"));
      }
   });