
//////////////////////////////////////////////
//            Endpoints Framework           //
//////////////////////////////////////////////
const endpoint = require('slingr-endpoints');

//////////////////////////////////////////////
//              Endpoint Hooks              //
//////////////////////////////////////////////
endpoint.hooks.onEndpointStart = () => {
    // the loggers, endpoint properties, data stores, etc. are initialized at this point. the endpoint is ready to be used.
    endpoint.logger.info('From Hook - Endpoint has started');
    endpoint.appLogger.info('From Hook - Endpoint has started')
};
endpoint.hooks.onEndpointStop = (cause) => {
    //The endpoint is about to stop at this point. Use this to release all resources that could cause a memory leak. 
    endpoint.logger.info('From Hook - Endpoint is stopping.');
    endpoint.appLogger.info('From Hook - Endpoint is stopping.', cause);
};

//////////////////////////////////////////////
//            Endpoint Functions            //
//////////////////////////////////////////////
endpoint.functions.randomNumber = (params) => {

    // this log will be sent to the app and can be seen in the general logs in the app monitor
    endpoint.appLogger.info("Request to generate random number received", params);

    // generate random number
    let max = 10000;
    if (params.max) {
        if (typeof params.max === 'number') {
            max = params.max;
        } else {
            throw new Error('Parameter "max" is not a valid number');
        }
    }
    let responseToApp = {};
    responseToApp.number = Math.round(Math.random() * max);

    // this is an internal log of the endpoint
    endpoint.logger.info('Random number generated:' + responseToApp.number);

    //Here we check if the number has been generated before, if so, we increment its ocurrences added the timestamp. Else, we save it on the dataStore.
    endpoint.dataStores.dataStore1.findOne({ randomNumber: responseToApp.number }).then((savedRandomNumber) => {
        if (!savedRandomNumber) {
            endpoint.dataStores.dataStore1.save({
                randomNumber: responseToApp.number.toString(),
                ocurrences: [new Date().getTime().toString()]
            });
        } else {
            savedRandomNumber.ocurrences.push(new Date().getTime().toString());
            endpoint.dataStores.dataStore1.update(savedRandomNumber._id, savedRandomNumber);
        }
    }).catch((err) => {
        endpoint.logger.error('error while querying the db.');
        endpoint.appLogger.error('error while querying the db.', err);
    });

    return responseToApp;
}

endpoint.functions.ping = (req) => {
    // in this case as the argument is FunctionRequest we don't get only the body of the request,
    // but all the information associated to it, which is needed when having callbacks

    // this log will be sent to the app and can be seen in the general logs in the app monitor
    endpoint.appLogger.info("Request to ping received", req);

    let data = req.params;

    let res = {};
    res.token = endpoint.settings.token;
    res.ping = "pong";

    //send event
    endpoint.events.send("pong", data, req.id);

    // this is an internal log of the endpoint
    endpoint.logger.info("Pong sent to app");

    // we will return the status for the function call, while the real response will go in the callback
    return { status: 'ok' };
};
endpoint.functions.error = (req) => {
    endpoint.appLogger.warn("Request to generate error received");

    throw new Error("Error generated!");
}

endpoint.functions.downloadFileFromEndpoint = (endpointRequest) => {
    const parameters = endpointRequest.params;
    endpoint.files.download(parameters.fileId).then(
        (res) => {
            logger.info('File download has completed!')
            endpoint.events.send('testCallback', null, endpointRequest.id)
        }
    );
    return { msg: 'file is being downloaded' }
};

endpoint.functions.uploadFileFromEndpoint = (endpointRequest) => {
    try {
        endpoint.httpModule.get('https://jsoncompare.org/LearningContainer/SampleFiles/PDF/sample-pdf-with-images.pdf',
            {
                responseType: "arraybuffer"
            }).then(
                (res) => {
                    endpoint.files.upload('somefile.pdf', res.data)
                        .then((fileResponse) => {
                            endpoint.events.send('onUploadFinished', fileResponse, endpointRequest.id);
                        });
                }
            );
    } catch (error) {
        console.error("el error es: ", error);
    }

    return { msg: 'file is being downloaded' }
};

endpoint.functions.executeScript = (endpointRequest) => {
    const {script, parameters} = endpointRequest.params;
    
    endpoint.scripts.execute();
}

//////////////////////////////////////////////
//          Endpoint Web Services           //
//////////////////////////////////////////////
endpoint.webServices.webhooks = {
    method: 'POST',
    path: '/',
    handler: function (req, res) {
        let body;
        try {
            body = req.body;
        } catch (err) {
            throw new Error("Body must be valid JSON");
        }

        // send event to app
        endpoint.events.send("inboundEvent", body);

        // this is what the webhook caller receives as response
        res.send({ status: "ok" });
    }
}

//Always call this method at the end of the file to run the endpoint
endpoint.start();