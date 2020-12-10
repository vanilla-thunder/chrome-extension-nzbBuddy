'use strict';

// Define the `phonecatApp` module
var app = angular.module('app', [])
    .controller('ctrl', function controller($scope) {

        var bullshitRegex = '(-[^\\s\\.\\{]+)?';
        $scope.defaultTitleRepalces = [
            '(2160|1080|720)(p|i)', '(U|F)HD', // Auflösung
            'DD(P(lus)?)?\\s?(2|5|7)\\.?(0|1)|E?AC3L?D?|DL|DTS-?H?D?|AAC(2|5|7)\\.?(0|1)?', // Tonspur
            'True-?HD','(Dolby)?Atmos',
            'Ger(man)?',
            'Dub(bed)?','Sync(ed)?',
            '(AMZN|Amazon|iTunes|hulu|maxdome|netflix)(HD)?',
            '(Blue?Ray|web(rip|hd)?|hdtv)'+bullshitRegex,
            'HDR(10)?(plus)?', 'HEVC', '(h|x)\\.?26(4|5)'+bullshitRegex, // codec
            '(iNTERNAL|miUHD|MZABI|TvR|TVS|EVO|NIMA4K)'+bullshitRegex,// releases
            // sonstiges:
            'AVC'+bullshitRegex, 'xxx','mp4'+bullshitRegex,
            'REMUX'+bullshitRegex, 'repack'+bullshitRegex,'proper'+bullshitRegex,
            ' - Usenet - 4all', // u4a website title
        ];
        
        $scope.defaultCategories = [
            {
                title: 'xxx',
                regex: 'u?n?censored|xxx|sex|erotic',
            },{
                title:'tv',
                regex: '(s\\d{1,2})?e\d{1,2}|episode\\s?\\d{1,2}|\\d{1,2}x\\d{1,2}'
            },{
                title: 'default',
                regex: 's\\d{1,2}' // staffel komplett
            },{
                title: 'movie',
                regex: '2160p|1080p|720p|UHD|FHD|HD'
            }
        ];
        
            $scope.settings = {
            local: {
                nzbclient: '',
                url: '',
                auth: '',
                debug: 0
            },
            global: {
                categories: $scope.defaultCategories,
                titlecleanup: true,
                titlereplaces: $scope.defaultTitleRepalces,
                sites: []
            }
        };
        $scope.resetCategories = function() {
            $scope.settings.global.categories = $scope.defaultCategories;
            $scope.saveSettings();
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