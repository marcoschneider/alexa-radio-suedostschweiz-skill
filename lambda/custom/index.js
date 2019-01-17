'use strict';

const Alexa = require('ask-sdk');
const constants = require('./constants');
const parseString = require('xml2js').parseString;
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const https = require('https');

const util = require('util');

const LaunchRequestHandler = {
  canHandle(handleInput) {
    console.log("Launch Request: " + util.inspect(handleInput, {showHidden: false, depth: null}));
    return handleInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const speakOutput = requestAttributes.t('WELCOME_MESSAGE', requestAttributes.t('SKILL_NAME'));
    const repromptOutput = requestAttributes.t('WELCOME_REPROMPT');

    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(repromptOutput)
        .getResponse();
  }
};

const PlayRadioIntent = {
  canHandle(handleInput) {
    console.log("Play Radio: " + util.inspect(handleInput, {showHidden: false, depth: null}));
    return handleInput.requestEnvelope.request.type === 'IntentRequest'
        && handleInput.requestEnvelope.request.intent.name === 'PlayRadioIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

    let speakOutput = "";

    console.log(util.inspect(requestAttributes, {showHidden: false, depth: null}));
    console.log(util.inspect(constants, {showHidden: false, depth: null}));

    if (constants.RADIO.url) {
      return handlerInput.responseBuilder
          .speak("Viel spasss mit dem Radio von Südostschweiz.")
          .addAudioPlayerPlayDirective('REPLACE_ALL', constants.RADIO.url, constants.RADIO.url, null, 0)
          .getResponse();
    }
    else{
      speakOutput = requestAttributes.t('RADIO_URL_NOT_FOUND');
      return handlerInput.responseBuilder
          .speak(speakOutput)
          .getResponse();
    }
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    console.log("Inside SessionEndedRequestHandler");
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`-----------------------`);
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
        .speak('Ich konnte dich leider nicht verstehen.')
        .reprompt('Ich konnte dich leider nicht verstehen.')
        .getResponse();
  },
};

/* CONSTANTS */
const skillBuilder = Alexa.SkillBuilders.standard();
const languageStrings = {
  de: {
    translation: {
      SKILL_NAME: 'Radio Südostschweiz',
      WELCOME_MESSAGE: 'Willkommen bei %s. Mit Alexa starte Radio gelangst du zum Livestream. Um die Podcasts zu hören, sag: "liste mir alle Podcasts auf". Was möchtest du tun?',
      WELCOME_REPROMT: 'Mit Alexa starte Radio gelangst du zum Live Radio. Und Falls du Hilfe brauchst, sag einfach "hilf mir".',
      STOP_MESSAGE: 'Alles klar, auf wiedersehen',
      RADIO_URL_NOT_FOUND: 'Ich konnte die Radio URL nicht finden.'
    }
  }
};

// Finding the locale of the user
const LocalizationInterceptor = {
  process(handlerInput) {
    const localizationClient = i18n.use(sprintf).init({
      lng: handlerInput.requestEnvelope.request.locale,
      overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
      resources: languageStrings,
      returnObjects: true
    });

    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function (...args) {
      return localizationClient.t(...args);
    };
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    const playbackInfo = getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    console.log("Exit Handler: " + util.inspect(playbackInfo, {showHidden: false, depth: null}));

    return !playbackInfo.inPlaybackSession &&
        request.type === 'IntentRequest' &&
        (request.intent.name === 'AMAZON.StopIntent' ||
            request.intent.name === 'AMAZON.CancelIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
        .speak('Auf wiedersehen!')
        .getResponse();
  },
};

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

async function getPlaybackInfo(handlerInput) {
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();
  return attributes.playbackInfo;
}

function getPodcastEpisodes() {

}


/* LAMBDA SETUP */
exports.handler = skillBuilder
  .addRequestHandlers(
      CheckAudioInterfaceHandler,
      LaunchRequestHandler,
      SessionEndedRequestHandler,
      PlayRadioIntent,
      ExitHandler
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .withAutoCreateTable(true)
  .withTableName(constants.dynamoDBTableName)
  .lambda();