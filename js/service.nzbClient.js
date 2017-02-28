angular.module("app").service("nzbClient", function ($http, $q) {

    var _this = this;
    this.settings = {};
    this.queue = {};

    var apiRequest = function (method, success, failure) {
        var endpoint = {
            'SabNZBd': '/api?output=json&apikey=',
            'NewsBin': '/api?output=json'
        };

        return $http.get(_this.settings.url + endpoint[_this.settings.client] + _this.settings['api-key'] + '&' + method).then(function (res) {
            console.log("method");
            console.log(res.data);
            success(res.data);
        }, function errorCallback(response) {
            if (failure) failure();
            else console.log("Das war jetzt echt kacke!", "", "ok", function () {
            });
        });
    };


    this.loadSettings = function (callback) {
        chrome.storage.sync.get('settings', function (data) {
            _this.settings = data.settings;
            //angular.copy(data.settings, this.settings);
            console.log("settings loaded",_this.settings);
            callback(_this.settings);
        });
    };
    this.saveSettings = function () {
        chrome.storage.sync.set({'settings': _this.settings}, function () {
            LxNotificationService.success('settings saved');
        })
    };

    this.loadQ = function () {
        apiRequest('mode=queue', function (data) {
            angular.copy(data, _queue);
        });
    };

    this.test = function () {
        //if (jQuery.isEmptyObject(this.settings)) console.log("_settings not set!");
        var data = apiRequest('mode=version', function (data) {
            console.log(data);
            console.log(_this.settings.client + ' ' + data.version + ' running');
        }, function () {
            console.log("Läuft SabNZBd überhaupt?");
        });
    };

    this.add = function (nztb) {
        apiRequest('mode=pause');
    };
    this.pause = function () {
        apiRequest('mode=pause');
    };
    this.resume = function (nztb) {
        apiRequest('mode=resume');
    };

//    this.loadSettings();
});