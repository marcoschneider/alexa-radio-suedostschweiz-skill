'use strict';

const constants = require('./constants');
const interceptors = require('./handlers/Interceptors');
const intentHandlers = require('./handlers/IntentHandlers');
const skillBuilder = require('./constants').skillBuilder;
const controller = require('./controller');
const helpers = require('./helpers');

const util = require('util');

const LaunchRequestHandler = {
  canHandle(handleInput) {
    //console.log("Launch Request: " + util.inspect(handleInput, {showHidden: false, depth: null}));
    return handleInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

    const speakOutput = requestAttributes.t('WELCOME_MESSAGE', requestAttributes.t('SKILL_NAME'));
    const repromptOutput = requestAttributes.t('WELCOME_REPROMPT');

    return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(repromptOutput)
        .getResponse();
  }
};

// Finding the locale of the user

/*Audio Event Handler*/
const CheckAudioInterfaceHandler = {
  canHandle(handlerInput) {
    const audioPlayerInterface = ((((handlerInput.requestEnvelope.context || {}).System || {}).device || {}).supportedInterfaces || {}).AudioPlayer;
    return audioPlayerInterface === undefined
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
        .speak('Sorry, dieser Skill wird nicht auf Ihrem Gerät unterstützt.')
        .withShouldEndSession(true)
        .getResponse();
  },
};

const PausePlaybackHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await helpers.getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    return playbackInfo.inPlaybackSession &&
        request.type === 'IntentRequest' &&
        request.intent.name === 'AMAZON.PauseIntent';
  },
  handle(handlerInput) {
    return controller.pause(handlerInput);
  },
};

const StartPlaybackHandler = {
  async canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;

    if (request.type === 'PlaybackController.PlayCommandIssued') {
      return true;
    }

    if (request.type === 'IntentRequest') {
      return request.intent.name === 'AMAZON.ResumeIntent';
    }
  },
  handle(handlerInput) {
    return controller.resume(handlerInput);
  },
};


/* LAMBDA SETUP */
exports.handler = skillBuilder
    .addRequestHandlers(
        CheckAudioInterfaceHandler,
        PausePlaybackHandler,
        StartPlaybackHandler,
        LaunchRequestHandler,
        intentHandlers.SessionEndedRequestHandler,
        intentHandlers.PlayRadioIntent,
        intentHandlers.ListAllPodcastsIntent,
        intentHandlers.ExitHandler
    )
    .addRequestInterceptors(interceptors.LocalizationInterceptor)
    .addErrorHandlers(intentHandlers.ErrorHandler)
    .addRequestInterceptors(interceptors.LoadPersistentAttributesRequestInterceptor)
    .addResponseInterceptors(interceptors.SavePersistentAttributesResponseInterceptor)
    .withAutoCreateTable(true)
    .withTableName(constants.settings.dynamoDBTableName)
    .lambda();