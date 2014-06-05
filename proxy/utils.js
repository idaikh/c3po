"use strict";

Array.prototype.contains = function (data) {
   for (var i in this) {
       if (this[i] == data) return true;
   }
   return false;
}