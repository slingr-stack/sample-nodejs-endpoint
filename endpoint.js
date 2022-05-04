
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

//Functions receive a request parameter which has some info that the platform adds plus.
//the arguments sent to the function
endpoint.functions.randomNumber = (req) => {

    // this log will be sent to the app and can be seen in the general logs in the app monitor.
    endpoint.appLogger.info('Request to generate random number received', req);

    //This is how we fetch the arguments sent to the function from the slingr app.
    const params = req.params;

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
    endpoint.logger.info('Random number generated: ', responseToApp.number);

    //Functions should always return a valid JSON or object
    return responseToApp;
}

endpoint.functions.findAndSaveDocument = (req) => {
    const document = req.params;
    //Here we search for a doc with the same id. If found, we update it. 
    //If no id is sent, we save it on the dataStore as a new document.
    if (document.id) {
        endpoint.dataStores.dataStore1.findOne({ _id: document.id }).then((savedDoc) => {
            if (!savedDoc) {
                const updatedDocument = { ...savedDoc, ...document }
                endpoint.dataStores.dataStore1.update(updatedDocument.id, updatedDocument).then((updatedDoc) => {
                    endpoint.logger.info('Document [' + document.id + '] updated succesfully', updatedDoc);
                    endpoint.appLogger.info('Document [' + document.id + '] updated succesfully', updatedDoc);
                });
            } else {
                endpoint.logger.warn('No document found with id [' + document.id + ']');
                endpoint.appLogger.warn('No document found with id [' + document.id + ']');
            }
        }).catch((err) => {
            endpoint.logger.error('error while querying the db.');
            endpoint.appLogger.error('error while querying the db.', err);
        });
    } else {
        document.createdAt = new Date().getTime()
        endpoint.dataStores.dataStore1.save(document).then((newDocument) => {
            endpoint.logger.info('Document saved successfully', newDocument);
            endpoint.appLogger.info('Document saved successfully', newDocument);
        });
    }

    return { msg: 'ok' };
}

endpoint.functions.ping = (req) => {

    endpoint.appLogger.info('Request to ping received', req);

    let data = req.params;

    let res = {};
    //This is how we access the settings of the endpoint
    res.token = endpoint.settings.token;
    res.ping = 'pong';

    //send 'pong' event. This will cause either the listener, or the callback to be executed sometime in the future.
    endpoint.events.send('pong', data, req.id);

    endpoint.logger.info('Pong sent to app');

    return { status: 'ok' };
};

endpoint.functions.error = (req) => {
    endpoint.appLogger.warn('Request to generate error received');

    throw new Error('Error generated!');
}

endpoint.functions.downloadFileFromEndpoint = (endpointRequest) => {
    const file = endpointRequest.params;
    endpoint.files.download(file.id).then(
        (res) => {
            endpoint.logger.info('File download has completed!');
            //In this case we return res.toString() because we know the file being downloaded is a .txt. Its not recommended to return the plain buffer to the platform.
            endpoint.events.send('onDownloadComplete', res.toString(), endpointRequest.id)
        }
    );
    return { msg: 'File [' + file.id + '] is being downloaded.' }
};

endpoint.functions.uploadFileFromEndpoint = (endpointRequest) => {
    const fileUrl = 'https://jsoncompare.org/LearningContainer/SampleFiles/PDF/sample-pdf-with-images.pdf'; 
    endpoint.httpModule.get(fileUrl).then( res => {
                endpoint.files.upload('somefile.pdf', res.data)
                    .then((fileResponse) => {
                        endpoint.events.send('onUploadComplete', fileResponse, endpointRequest.id);
                    });
        }).catch( error => {
            endpoint.logger.error('Couldn\'t download the file from ['+fileUrl+'].',error);
        });

    return { msg: 'file is being downloaded' }
};


endpoint.functions.executeScript = (endpointRequest) => {
    const { scriptName, parameters } = endpointRequest.params;

    const res = endpoint.scripts.execute(scriptName, parameters);
    return {msg: 'Script ['+scriptName+'] will be executed shortly in a separate job',response: res};
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
            throw new Error('Body must be valid JSON');
        }

        // send event to app
        endpoint.events.send('inboundEvent', body);

        // this is what the webhook caller receives as response
        res.send({ status: 'ok' });
    }
}

//Always call this method at the end of the file to run the endpoint
endpoint.start();