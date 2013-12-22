define([
  'angular',
  'underscore',
  'config',
  '/app/services/graphite/functions.js'
],
function (angular, _, config, graphiteFunctions) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('GraphiteTargetCtrl', function($scope, $http) {

    $scope.init = function() {
      $scope.segments = _.map($scope.target.target.split('.'), function (segmentStr) {
        return {
          val: segmentStr,
          html: segmentStr === '*' ? '<i class="icon-asterisk"><i>' : segmentStr
        };
      });

      $scope.funcDefs = graphiteFunctions;
      $scope.functions = [];
    };

    function getSegmentPathUpTo(index) {
      var arr = $scope.segments.slice(0, index);

      return _.reduce(arr, function(result, segment) {
        return result ? (result + "." + segment.val) : segment.val;
      }, null);
    }

    function graphiteMetricQuery(query) {
      var url = config.graphiteUrl + '/metrics/find/?query=' + query;
      return $http.get(url);
    }

    function checkOtherSegments(fromIndex) {
      var path = getSegmentPathUpTo(fromIndex + 1);
      return graphiteMetricQuery(path)
        .then(function(result) {
          if (result.data.length === 0) {
            $scope.segments = $scope.segments.splice(0, fromIndex);
            $scope.segments.push({html: 'select metric'});
            return;
          }
          if (result.data[0].expandable) {
            if ($scope.segments.length === fromIndex) {
              $scope.segments.push({html: 'select metric'});
            }
            else {
              return checkOtherSegments(fromIndex + 1);
            }
          }
        });
    }

    function setSegmentFocus(segmentIndex) {
      _.each($scope.segments, function(segment, index) {
        segment.focus = segmentIndex === index;
      });
    }

    function getFuncText(funcDef, params) {
      if (params.length === 0) {
        return funcDef.name + '()';
      }

      var text = funcDef.name + '(';
      _.each(funcDef.params, function(param, index) {
        text += params[index] + ', ';
      });
      text = text.substring(0, text.length - 2);
      text += ')';
      return text;
    }

    function wrapFunction(target, func) {
      var targetWrapped = func.def.name + '(' + target;
      _.each(func.params, function(param) {
        if (_.isString(param)) {
          targetWrapped += ",'" + param + "'";
        }
        else {
          targetWrapped += "," + param;
        }
      });
      return targetWrapped + ')';
    }

    $scope.getAltSegments = function (index) {
      $scope.altSegments = [];

      return graphiteMetricQuery(getSegmentPathUpTo(index) + '.*')
        .then(function(result) {
          var altSegments = _.map(result.data, function(altSegment) {
            return {
              val: altSegment.text,
              html: altSegment.text,
              expandable: altSegment.expandable
            };
          });

          altSegments.unshift({val: '*', html: '<i class="icon-asterisk"></i>' });
          $scope.altSegments = altSegments;
        });
    };

    $scope.setSegment = function (altIndex, segmentIndex) {
      $scope.segments[segmentIndex].val = $scope.altSegments[altIndex].val;
      $scope.segments[segmentIndex].html = $scope.altSegments[altIndex].html;

      if ($scope.altSegments[altIndex].expandable) {
        return checkOtherSegments(segmentIndex + 1)
          .then(function () {
            setSegmentFocus(segmentIndex + 1);
            $scope.targetChanged();
          });
      }

      setSegmentFocus(segmentIndex + 1);
      $scope.targetChanged();
    };

    $scope.targetChanged = function() {
      var target = getSegmentPathUpTo($scope.segments.length);
      target = _.reduce($scope.functions, wrapFunction, target);
      console.log('target: ', target);
      $scope.target.target = target;
      $scope.$parent.get_data();
    };

    $scope.removeFunction = function(func) {
      $scope.functions = _.without($scope.functions, func);
      $scope.targetChanged();
    };

    $scope.functionParamsChanged = function(func) {
      func.text = getFuncText(func.def, func.params);
      $scope.targetChanged();
    };

    $scope.addFunction = function(funcDef) {
      $scope.functions.push({
        def: funcDef,
        params: funcDef.defaultParams,
        text: getFuncText(funcDef, funcDef.defaultParams)
      });
      $scope.targetChanged();
    };

  });

  module.directive('focusMe', function($timeout, $parse) {
    return {
      //scope: true,   // optionally create a child scope
      link: function(scope, element, attrs) {
        var model = $parse(attrs.focusMe);
        scope.$watch(model, function(value) {
          if(value === true) {
            $timeout(function() {
              element[0].focus();
            });
          }
        });
      }
    };
  });

});