angular.module('c3po')
   .filter('iif', function () {
      return function (input, trueValue, falseValue) {
         return input ? trueValue : falseValue;
      };
   })
   .filter('isEmpty', function () {
      var key;
      return function (obj) {
         for (key in obj) {
            if (obj.hasOwnProperty(key)) {
               return false;
            }
         }
         return true;
      };
   });