'use strict';

angular.module('app', ['lumx']).controller('ctrl', function ($scope, $http,LxNotificationService ) {

    $scope.options = [
        {title: 'client', type: 'radio', values: ['SabNZBd', 'NewsBin']},
        {title: 'url', type: 'url'},
        {title: 'api-key', type: 'text', values: []},
        {title: 'nzb-key', type: 'text', values: []},
        {title: 'cat-tv', type:'text'},
        {title: 'cat-movie', type:'text'},
        {title: 'cat-xxx', type:'text'}
    ];
    $scope.settings = {};
    $scope.sites = '';

    $scope.loadSettings = function() {
        chrome.storage.sync.get('settings', function(data) {
            $scope.settings = data.settings;
            $scope.$apply();
        });
    };
    $scope.saveSettings = function() {
        chrome.storage.sync.set({'settings': $scope.settings}, function() {
            LxNotificationService.success("settings saved!");
        });
    };

    $scope.loadSettings("settings");
    //$scope.loadSettings("sites");

    $scope.validate = function (type, value) {
        switch (type) {
            case "url":
                return /https?:\/\/.+/gi.test(value);
                break;
            default:
                return (typeof value !== "undefined" && value.length > 0) ? true : false;
                break;
        }
    };
    $scope.getValidationError = function (type) {
        switch (type) {
            case "url":
                return 'URL must contain http/s and port number, like: http://localhost:8080';
                break;
            default:
                return 'this field is required!';
                break;
        }
    };
    $scope.testSettings = function () {
        //if (jQuery.isEmptyObject(settings)) console.log("_settings not set!");
        var data = apiRequest('mode=version', function (data) {
            console.log(data);
            console.log(settings.client + ' ' + data.version + ' running');
        }, function () {
            console.log("Läuft SabNZBd überhaupt?");
        });
    };
    //$scope.options.forEach(function (value, index, array) { $scope.settings[value.title] = ''; });
});