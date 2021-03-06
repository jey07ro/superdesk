
(function() {

'use strict';

MetadataCtrl.$inject = ['$scope', 'desks', 'metadata', '$filter', 'privileges', 'adminPublishSettingsService', 'datetimeHelper'];
function MetadataCtrl($scope, desks, metadata, $filter, privileges, adminPublishSettingsService, datetimeHelper) {
    desks.initialize()
    .then(function() {
        $scope.deskLookup = desks.deskLookup;
        $scope.userLookup = desks.userLookup;
    });

    metadata.initialize().then(function() {
        $scope.metadata = metadata.values;
        if ($scope.item.related_to != null) {
            metadata.fetchAssociated($scope.item.related_to)
            .then(function(item) {
                $scope.associatedItem = item;
            });
        }
    });

    $scope.processGenre = function() {
        $scope.item.genre = _.map($scope.item.genre, function(g) {
            return _.pick(g, 'name');
        });
    };

    $scope.$watch('item.publish_schedule_date', function(newValue, oldValue) {
        setPublishScheduleDate(newValue, oldValue);
    });

    $scope.$watch('item.publish_schedule_time', function(newValue, oldValue) {
        setPublishScheduleDate(newValue, oldValue);
    });

    function setPublishScheduleDate(newValue, oldValue) {
        if (newValue !== oldValue) {
            if ($scope.item.publish_schedule_date && $scope.item.publish_schedule_time) {
                $scope.item.publish_schedule = datetimeHelper.mergeDateTime($scope.item.publish_schedule_date,
                    $scope.item.publish_schedule_time).format();
            } else {
                $scope.item.publish_schedule = false;
            }

            $scope.autosave($scope.item);
        }
    }

    function resolvePublishScheduleDate() {
        if ($scope.item.publish_schedule) {
            var publishSchedule = new Date(Date.parse($scope.item.publish_schedule));
            $scope.item.publish_schedule_date = moment(publishSchedule).utc().format('MM/DD/YYYY');
            $scope.item.publish_schedule_time = moment(publishSchedule).utc().format('HH:mm:ss');
        }
    }

    $scope.unique_name_editable = Boolean(privileges.privileges.metadata_uniquename);
    resolvePublishScheduleDate();
}

MetadataDropdownDirective.$inject = [];
function MetadataDropdownDirective() {
    return {
        scope: {
            list: '=',
            disabled: '=',
            item: '=',
            field: '@',
            change: '&'
        },
        templateUrl: 'scripts/superdesk-authoring/metadata/views/metadata-dropdown.html',
        link: function(scope) {
            scope.select = function(item) {
                scope.item = scope.field ? item[scope.field] : item;
                scope.change({item: scope.item});
            };
        }
    };
}

MetadataWordsListEditingDirective.$inject = [];
function MetadataWordsListEditingDirective() {
    return {
        scope: {
            item: '=',
            field: '@',
            disabled: '=',
            list: '=',
            change: '&'
        },
        templateUrl: 'scripts/superdesk-authoring/metadata/views/metadata-words-list.html',
        link: function(scope) {

            var ENTER = 13;

            scope.selectTerm = function($event) {
                if ($event.keyCode === ENTER && _.trim(scope.term) !== '') {

                    //instead of simple push, extend the item[field] in order to trigger dirty $watch
                    var t = _.clone(scope.item[scope.field]) || [];
                    var index = _.findIndex(t, function(word) {
                        return word.toLowerCase() === scope.term.toLowerCase();
                    });

                    if (index < 0) {
                        t.push(_.trim(scope.term));

                        //build object
                        var o = {};
                        o[scope.field] = t;
                        _.extend(scope.item, o);
                        scope.change({item: scope.item});
                    }

                    scope.term = '';
                }
            };

            scope.removeTerm = function(term) {
                var temp = _.without(scope.item[scope.field], term);

                //build object
                var o = {};
                o[scope.field] = temp;

                _.extend(scope.item, o);

                scope.change({item: scope.item});
            };

        }
    };
}

/**
 * Wraping  'sd-typeahead' directive for editing of metadata list attributes
 *
 * @param {Object} item - specify the content item itself
 * @param {String} field - specify the (metadata) filed under the item which will be edited
 * @param {Boolean} disabled - whether component should be disabled for editing or not
 * @param {Array} list - list of available values that can be added
 * @param {String} unique - specify the name of the field, in list item which is unique (qcode, value...)
 *
 */
MetadataListEditingDirective.$inject = ['metadata'];
function MetadataListEditingDirective(metadata) {
    return {
        scope: {
            item: '=',
            field: '@',
            disabled: '=',
            list: '=',
            unique: '@',
            postprocessing: '&',
            change: '&'
        },
        templateUrl: 'scripts/superdesk-authoring/metadata/views/metadata-terms.html',
        link: function(scope) {

            metadata.subjectScope = scope;

            scope.$watch('list', function(items) {
                if (!items || !items[0].hasOwnProperty('parent')) {
                    return;
                }

                var tree = {};
                angular.forEach(items, function(item) {
                    if (!tree.hasOwnProperty(item.parent)) {
                        tree[item.parent] = [item];
                    } else {
                        tree[item.parent].push(item);
                    }
                });

                scope.tree = tree;
                scope.activeTree = tree[null];
            });

            scope.openParent = function(term, $event) {
                var parent = _.find(scope.list, {qcode: term.parent});
                scope.openTree(parent, $event);
            };

            scope.openTree = function(term, $event) {
                scope.activeTerm = term;
                scope.activeTree = scope.tree[term ? term.qcode : null];
                $event.stopPropagation();
            };

            scope.terms = [];
            scope.selectedTerm = '';
            var uniqueField = scope.unique || 'qcode';

            scope.searchTerms = function(term) {
                if (!term) {
                    scope.terms = [];
                } else {
                    scope.terms = _.filter(scope.list, function(t) {
                        var searchObj = {};
                        searchObj[uniqueField] = t[uniqueField];
                        return ((t.name.toLowerCase().indexOf(term.toLowerCase()) !== -1) &&
                            !_.find(scope.item[scope.field], searchObj));
                    });
                }
                return scope.terms;
            };

            scope.selectTerm = function(term) {
                if (term) {

                    //instead of simple push, extend the item[field] in order to trigger dirty $watch
                    var t = _.clone(scope.item[scope.field]) || [];
                    t.push(term);

                    //build object
                    var o = {};
                    o[scope.field] = t;
                    _.extend(scope.item, o);

                    scope.selectedTerm = '';

                    scope.postprocessing();
                    scope.change({item: scope.item});
                }
            };

            scope.removeTerm = function(term) {
                metadata.removeSubjectTerm(term);
            };
        }
    };
}

MetadataService.$inject = ['api', '$q', 'staticMetadata'];
function MetadataService(api, $q, staticMetadata) {

    var service = {
        values: {},
        subjectScope: null,
        loaded: null,
        fetchMetadataValues: function() {
            var self = this;

            return api('vocabularies').query().then(function(result) {
                _.each(result._items, function(vocabulary) {
                    self.values[vocabulary._id] = vocabulary.items;
                });
            });
        },
        fetchStaticMetadata: function() {
            var self = this;

            _.each(staticMetadata, function(source) {
                self.values[source._id] = source.items;
            });
            return $q.when();
        },
        fetchSubjectcodes: function(code) {
            var self = this;
            return api.get('/subjectcodes').then(function(result) {
                self.values.subjectcodes = result._items;
            });
        },
        fetchAssociated: function(_id) {
            if (_id != null) {
                return api('archive').getById(_id).then(function(_item) {
                    return _item;
                });
            }
        },
        removeSubjectTerm: function(term) {
            var self = this,
                tempItem = {},
                subjectCodesArray = self.subjectScope.item[self.subjectScope.field],
                filteredArray = _.without(subjectCodesArray, term);

            if (filteredArray.length === subjectCodesArray.length) {
                _.remove(filteredArray, {name: term});
            }

            tempItem[self.subjectScope.field] = filteredArray;

            _.extend(self.subjectScope.item, tempItem);

            self.subjectScope.change({item: self.subjectScope.item});
        },
        initialize: function() {
            if (!this.loaded) {
                this.loaded = this.fetchMetadataValues()
                    .then(angular.bind(this, this.fetchStaticMetadata))
                    .then(angular.bind(this, this.fetchSubjectcodes));
            }
            return this.loaded;
        }
    };

    return service;
}

//hardcoded metadata values
var staticMetadata = [
    {
        _id: 'priority',
        items: [
            {
                name: 'B',
                qcode: 'B'
            },
            {
                name: 'D',
                qcode: 'D'
            },
            {
                name: 'F',
                qcode: 'F'
            },
            {
                name: 'R',
                qcode: 'R'
            },
            {
                name: 'U',
                qcode: 'U'
            },
            {
                name: 'Z',
                qcode: 'Z'
            }
        ]
    }
];
angular.module('superdesk.authoring.metadata', ['superdesk.authoring.widgets'])
    .config(['authoringWidgetsProvider', function(authoringWidgetsProvider) {
        authoringWidgetsProvider
            .widget('metadata', {
                icon: 'info',
                label: gettext('Info'),
                template: 'scripts/superdesk-authoring/metadata/views/metadata-widget.html',
                order: 1,
                side: 'right',
                display: {authoring: true, packages: true}
            });
    }])

    .controller('MetadataWidgetCtrl', MetadataCtrl)
    .service('metadata', MetadataService)
    .directive('sdMetaTerms', MetadataListEditingDirective)
    .directive('sdMetaDropdown', MetadataDropdownDirective)
    .directive('sdMetaWordsList', MetadataWordsListEditingDirective)
    .value('staticMetadata', staticMetadata);
})();
