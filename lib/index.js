'use strict'

var _require = require('apollo-link'),
  ApolloLink = _require.ApolloLink,
  Observable = _require.Observable

var _require2 = require('apollo-link-http-common'),
  selectURI = _require2.selectURI,
  selectHttpOptionsAndBody = _require2.selectHttpOptionsAndBody,
  fallbackHttpConfig = _require2.fallbackHttpConfig,
  serializeFetchParameter = _require2.serializeFetchParameter,
  createSignalIfSupported = _require2.createSignalIfSupported,
  parseAndCheckHttpResponse = _require2.parseAndCheckHttpResponse

var _require3 = require('extract-files'),
  extractFiles = _require3.extractFiles,
  ReactNativeFile = _require3.ReactNativeFile

exports.ReactNativeFile = ReactNativeFile

exports.createUploadLink = function(_temp) {
  var _ref = _temp === void 0 ? {} : _temp,
    _ref$uri = _ref.uri,
    fetchUri = _ref$uri === void 0 ? '/graphql' : _ref$uri,
    _ref$fetch = _ref.fetch,
    linkFetch = _ref$fetch === void 0 ? fetch : _ref$fetch,
    fetchOptions = _ref.fetchOptions,
    credentials = _ref.credentials,
    headers = _ref.headers,
    includeExtensions = _ref.includeExtensions

  var linkConfig = {
    http: {
      includeExtensions: includeExtensions
    },
    options: fetchOptions,
    credentials: credentials,
    headers: headers
  }
  return new ApolloLink(function(operation) {
    var uri = selectURI(operation, fetchUri)
    var context = operation.getContext()
    var contextConfig = {
      http: context.http,
      options: context.fetchOptions,
      credentials: context.credentials,
      headers: context.headers
    }

    var _selectHttpOptionsAnd = selectHttpOptionsAndBody(
        operation,
        fallbackHttpConfig,
        linkConfig,
        contextConfig
      ),
      options = _selectHttpOptionsAnd.options,
      body = _selectHttpOptionsAnd.body

    var files = extractFiles(body)
    var payload = serializeFetchParameter(body, 'Payload')

    if (files.length) {
      delete options.headers['content-type']
      options.body = new FormData()
      options.body.append('operations', payload)
      options.body.append(
        'map',
        JSON.stringify(
          files.reduce(function(map, _ref2, index) {
            var path = _ref2.path
            map['' + index] = [path]
            return map
          }, {})
        )
      )
      files.forEach(function(_ref3, index) {
        var file = _ref3.file
        return options.body.append(index, file, file.name)
      })
    } else options.body = payload

    return new Observable(function(observer) {
      var _createSignalIfSuppor = createSignalIfSupported(),
        controller = _createSignalIfSuppor.controller,
        signal = _createSignalIfSuppor.signal

      if (controller) options.signal = signal

      // If this is a query, let's reassemble a raw query instead of using variables.
      let body = JSON.parse(options.body);
      if (body.query) {
        let rawQuery = body.query.split('{').splice(1).join('{').split('}').slice(0,-1).join('}');
        let keys = Object.keys(body.variables);
        for (const i in keys) {
          let val;
          if (keys[i].toLowerCase() === 'id' || typeof body.variables[keys[i]] === 'number') {
            val = body.variables[keys[i]];
          } else {
            val = '\'' + body.variables[keys[i]] + '\'';
          }
          const r = RegExp('\\$' + keys[i], 'g')
          rawQuery = rawQuery.replace(r, body.variables[keys[i]]);
        }
        rawQuery = rawQuery.replace(/\n/g, '');
        rawQuery = ' query { ' + rawQuery + ' } ';
        body = {
          operationName : body.operation,
          query : rawQuery,
          variables: null,
        }
        options.body = JSON.stringify(body);
      }
      linkFetch(uri, options)
        .then(function(response) {
          operation.setContext({
            response: response
          })
          return response
        })
        .then(parseAndCheckHttpResponse(operation))
        .then(function(result) {
          observer.next(result)
          observer.complete()
        })
        .catch(function(error) {
          if (error.name === 'AbortError') return
          if (error.result && error.result.errors && error.result.data)
            observer.next(error.result)
          observer.error(error)
        })
      return function() {
        if (controller) controller.abort()
      }
    })
  })
}
