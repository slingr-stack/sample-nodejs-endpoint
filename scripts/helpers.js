/**
 * These scripts are executed inside the app runtime, which means you have access to the
 * Javascript API and all the app data.
 *
 * Everything exposed under 'endpoint' will be available to the user through
 * 'app.endpoints.endpointName'.
 */


// this is shortcut of the 'ping' function
endpoint.pingPong = function(callback) {
    return endpoint.ping({}, {}, {
        'testCallback': callback
    });
};

// this is a utility the people can use in their apps
endpoint.createDate = function(millis) {
    return new Date(millis);
};

// this method makes uses of app data
endpoint.processData = function(record, field, value) {
    record.field(field).val(value);
    return sys.data.save(record);
};