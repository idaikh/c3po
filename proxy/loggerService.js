"use strict";

function LoggerService() {
    var loggedMsg=[];
    return {
        log:function(msg) {
            var date=new Date();
            var formattedDate=("0"+date.getDate()).slice(-2)+'/'+("0"+(date.getMonth()+1)).slice(-2)+'/'+date.getFullYear()+' '+("0"+date.getHours()).slice(-2)+'h'+("0"+date.getMinutes()).slice(-2);
            loggedMsg.push(formattedDate+' :: '+msg);
            console.log(formattedDate.blue+' :: '+msg);
        }
    };
}

module.exports = LoggerService();