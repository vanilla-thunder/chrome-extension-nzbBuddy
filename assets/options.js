'use strict';

// Define the `phonecatApp` module
var app = angular.module('app', [])
    .controller('ctrl', function controller($scope) {

        $scope.defaultTitleRepalces = [
            '(2160|1080|720)(p|i)', '(U|F)HD', // Auflösung
            'DD(20|51|71)|AC3L?D?|DL|DTS-?H?D?|AAC(20|51|71)?', // Tonspur
            'True-?HD','(Dolby)?Atmos',
            'Ger(man)?',
            'Dub(bed)?','Sync(ed)?',
            'AmazonH?D?|iTunes|iTunesH?D?|netflix',
            '(Blue?Ray|web(rip|hd)?|hdtv)(-[^\\s\\.\\{}]+)?',
            'HDR(10)?(plus)?', 'HEVC', '(h|x)26(4|5)(-[^\\s\\.\\{]+)?', // codec
            'iNTERNAL|miUHD|MZABI|TvR|TVS|EVO|NIMA4K',// releases
            // sonstiges:
            'AVC-4SJ', 'xxx','mp4(-[^\\s\\.\\{]+)?',
            'REMUX(-[^\\s\\.\\{]+)?', 'repack(-[^\\s\\.\\{]+)?','proper(-[^\\s\\.\\{}]+)?'];

        $scope.settings = {
            local: {
                nzbclient: '',
                url: '',
                auth: '',
                debug: 0
            },
            global: {
                titlecleanup: true,
                titlereplaces: $scope.defaultTitleRepalces,
                sites: []
            }
        };
        $scope.resetTitleRepalces = function() {
            $scope.settings.global.titlereplaces = $scope.defaultTitleRepalces;
            $scope.saveSettings();
        };
        $scope.loadSettings = function () {
            chrome.storage.local.get('settings', function (data) {
                console.log("loaded local settings:", data);
                if(!angular.equals(data, {})) {
                    $scope.settings.local = data.settings;
                    $scope.$apply();
                }
            });
            chrome.storage.sync.get('settings', function (data) {
                console.log("loaded global settings:", data);
                if(!angular.equals(data, {})) {
                    $scope.settings.global = data.settings;
                    $scope.$apply();
                }
            })
        };
        $scope.loadSettings();

        $scope.saveSettings = function () {
            chrome.storage.local.set({'settings': $scope.settings.local}, function () {
                console.log("local settings saved!");
            });
            chrome.storage.sync.set({'settings': $scope.settings.global}, function () {
                console.log("global settings saved!");
            });
        };

        $scope.sendMessage = function (_data) {
            console.log("sending message and data:");
            console.log(_data);
            chrome.runtime.sendMessage(_data, function (response) {
                console.log("response");
                console.log(response);
                if (typeof response.error !== "undefined") $scope.msg("das war nix!");
                else $scope.msg($scope.settings.client + " version: " + response.version);
                //$scope.msg($scope.settings.client + " version: " + response.version);
            });
        }
    });