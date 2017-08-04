'use strict';

angular.module('app', ['ngMaterial']).controller('ctrl', function ($scope, $http, $mdToast ) {

    $scope.msg = function(_msg,_time){
        $mdToast.show(
            $mdToast.simple()
                .textContent(_msg)
                .position('top right')
                .hideDelay(_time || 3000)
        );
    };

    $scope.settings = {
        'client':'sabnzbd',
        'url':'',
        'apikey':'',
        'sites': {}
    };

    $scope.loadSettings = function() {
        chrome.storage.sync.get('settings', function(data) {
            console.log("loaded settings:");
            console.log(data);
            $scope.settings = data.settings;
            //$.extend($scope.settings,data.settings)
            //$scope.$apply();
        });
    };
    $scope.saveSettings = function() {
        chrome.storage.sync.set({'settings': $scope.settings}, function() {
            $scope.msg("settings saved!");
        });
    };
$scope.clearStorage = function() {
    chrome.storage.sync.clear(function() {
        $scope.loadSettings();
    });
};
    $scope.loadSettings("settings");


    $scope.sendMessage = function(_data) {
        console.log("sending message and data:");
        console.log(_data);
        chrome.runtime.sendMessage(_data, function(response) {
            if(typeof response.error !== "undefined") $scope.msg("das war nix!");
            else $scope.msg($scope.settings.client + " version: " + response.version);
            console.log("response");
            console.log(response);
        });
    };

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            console.log(sender.tab ?
                "from a content script:" + sender.tab.url :
                "from the extension");
            if (request.greeting == "hello")
                sendResponse({farewell: "goodbye"});
        });
});
