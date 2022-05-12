
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
endpoint.functions.randomNumber = (endpointRequest) => {
    // this log will be sent to the app and can be seen in the general logs in the app monitor.
    endpoint.appLogger.info('Request to generate random number received', endpointRequest);

    //This is how we fetch the arguments sent to the function from the slingr app.
    const params = endpointRequest.params;

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


endpoint.functions.ping = (endpointRequest) => {
    endpoint.appLogger.info('Request to ping received', endpointRequest);

    let data = endpointRequest.params;

    let res = {};
    //This is how we access the settings of the endpoint
    res.token = endpoint.settings.token;
    res.ping = 'pong';

    //send 'pong' event. This will cause either the listener, or the callback to be executed sometime in the future.
    endpoint.events.send('pong', data, endpointRequest.id);

    endpoint.logger.info('Pong sent to app');

    return { status: 'ok' };
};

endpoint.functions.error = (endpointRequest) => {
    endpoint.appLogger.warn('Request to generate error received');

    throw new Error('Error generated!');
}

endpoint.functions.findAndSaveDocument = async (endpointRequest) => {
    const document = endpointRequest.params;
    //Here we search for a doc with the same id. If found, we update it. 
    //If no id is sent, we save it on the dataStore as a new document.
    let docResponse;
    if (document.id) {
        let existingDoc;
        try {
            existingDoc = await endpoint.dataStores.dataStore1.findOne({ _id: document.id });
        } catch (error) {
            endpoint.logger.error('error while querying the datastore.');
            endpoint.appLogger.error('error while querying the datastore.', err);
        }
        if (!existingDoc) {
            const updatedDocument = { ...savedDoc, ...document };
            docResponse = await endpoint.dataStores.dataStore1.update(updatedDocument.id, updatedDocument);
            endpoint.logger.info('Document [' + document.id + '] updated succesfully', updatedDoc);
            endpoint.appLogger.info('Document [' + document.id + '] updated succesfully', updatedDoc);
        } else {
            endpoint.logger.warn('No document found with id [' + document.id + ']');
            endpoint.appLogger.warn('No document found with id [' + document.id + ']');
        }
    } else {
        document.createdAt = new Date().getTime()
        docResponse = await endpoint.dataStores.dataStore1.save(document);
        endpoint.logger.info('Document saved successfully', newDocument);
        endpoint.appLogger.info('Document saved successfully', newDocument);
    }

    return docResponse;
}

endpoint.functions.asyncDownloadFileFromEndpoint = async (endpointRequest) => {
    const file = endpointRequest.params;
    endpoint.files.download(file.id).then(
        (res) => {
            endpoint.logger.info('File download has completed!');
            //In this case we return res.toString() because we know the file being downloaded is a .txt. Its not recommended to return the plain buffer to the platform.
            endpoint.events.send('onDownloadComplete', res.toString(), endpointRequest.id)
        }
    );
    return { msg: 'File [' + file.id + '] is being downloaded and the processing will be made asynchronously. An event will be fired when the download is complete.' }
};

endpoint.functions.syncDownloadFileFromEndpoint = async (endpointRequest) => {
    const file = endpointRequest.params;
    var fileResponse = await endpoint.files.download(file.id);
    endpoint.logger.info('File download has completed!');
    //In this case we return res.toString() because we know the file being downloaded is a .txt. Its not recommended to return the plain buffer to the platform.
    return { fileContents: fileResponse.toString() }
};

endpoint.functions.asyncUploadFileFromEndpoint = (endpointRequest) => {
    const fileUrl = 'https://jsoncompare.org/LearningContainer/SampleFiles/PDF/sample-pdf-with-images.pdf';
    //We download the dummy file from an HTTP request
    endpoint.httpModule.get(fileUrl).then(
        (downloadResponse) => {
            //And upload it to the platform
            endpoint.files.upload('somefile.pdf', downloadResponse.data).then(
                (fileInfo) => {
                    //In this case, the info will be sent asynchronously via events
                    endpoint.events.send('onUploadComplete', fileInfo, endpointRequest.id);
                }
            ).catch(
                (err) => {
                    endpoint.logger.error('Couldn\'t upload the file to platform.', err);
                }
            );
        }
    ).catch(
        (err) => {
            endpoint.logger.error('Couldn\'t download the file from [' + fileUrl + '].', err);
        }
    );

    return { msg: 'A file will be downloaded and then uploaded to the platform. This processing will be made asynchronously. An event will be fired when the download/upload is complete.' }
};

endpoint.functions.syncUploadFileFromEndpoint = async (endpointRequest) => {
    const fileUrl = 'https://jsoncompare.org/LearningContainer/SampleFiles/PDF/sample-pdf-with-images.pdf';
    try {
        //We download the dummy file from an HTTP request
        var downloadResponse = await endpoint.httpModule.get(fileUrl);
    } catch (error) {
        endpoint.logger.error('Couldn\'t download the file from [' + fileUrl + '].', error);
    }
    //And upload it to the platform
    var fileInfo = await endpoint.files.upload('somefile.pdf', downloadResponse.data);
    //The info is returned to the app synchronously 
    return fileInfo;
};

endpoint.functions.executeScript = async (endpointRequest) => {
    const { scriptName, parameters } = endpointRequest.params;

    const res = await endpoint.scripts.execute(scriptName, parameters);
    return { msg: 'Script [' + scriptName + '] was executed succesfully', response: res };
}

//////////////////////////////////////////////
//          Endpoint Web Services           //
//////////////////////////////////////////////
endpoint.webServices.webhooks = {
    method: 'POST',
    path: '/',
    handler: async (req, res) => {
        let body = req.body

        // send event to app
        let someResponseFromApp = await endpoint.events.sendSync('inboundEvent', body);

        // this is what the webhook caller receives as response
        res.send(someResponseFromApp);
    }
}

//Always call this method at the end of the file to run the endpoint
endpoint.start();