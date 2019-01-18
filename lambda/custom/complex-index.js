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
    const repromptOutput = requestAttributes.t('WELCOME_REPROMT');

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
          .audioPlayerPlay('REPLACE_ALL', constants.RADIO.url, constants.RADIO.url, null, 0)
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

/*INTERCEPTORS*/
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

const LoadPersistentAttributesRequestInterceptor = {
  async process(handlerInput) {
    const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

    // Check if user is invoking the skill the first time and initialize preset values
    if (Object.keys(persistentAttributes).length === 0) {
      handlerInput.attributesManager.setPersistentAttributes({
        playbackSetting: {
          loop: false,
          shuffle: false,
        },
        playbackInfo: {
          playOrder: [...Array(constants.PODCASTS.length).keys()],
          index: 0,
          offsetInMilliseconds: 0,
          playbackIndexChanged: true,
          token: '',
          nextStreamEnqueued: false,
          inPlaybackSession: false,
          hasPreviousPlaybackSession: false,
        },
      });
    }
  },
};

const SavePersistentAttributesResponseInterceptor = {
  async process(handlerInput) {
    await handlerInput.attributesManager.savePersistentAttributes();
  },
};

/*Audio Event Handler*/
const AudioPlayerEventHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type.startsWith('AudioPlayer.');
  },
  async handle(handlerInput) {
    const {
      requestEnvelope,
      attributesManager,
      responseBuilder
    } = handlerInput;
    const audioPlayerEventName = requestEnvelope.request.type.split('.')[1];
    const {
      playbackSetting,
      playbackInfo
    } = await attributesManager.getPersistentAttributes();

    switch (audioPlayerEventName) {
      case 'PlaybackStarted':
        playbackInfo.token = getToken(handlerInput);
        playbackInfo.index = await getIndex(handlerInput);
        playbackInfo.inPlaybackSession = true;
        playbackInfo.hasPreviousPlaybackSession = true;
        break;
      case 'PlaybackFinished':
        playbackInfo.inPlaybackSession = false;
        playbackInfo.hasPreviousPlaybackSession = false;
        playbackInfo.nextStreamEnqueued = false;
        break;
      case 'PlaybackStopped':
        playbackInfo.token = getToken(handlerInput);
        playbackInfo.index = await getIndex(handlerInput);
        playbackInfo.offsetInMilliseconds = getOffsetInMilliseconds(handlerInput);
        break;
      case 'PlaybackNearlyFinished':
      {
        if (playbackInfo.nextStreamEnqueued) {
          break;
        }

        const enqueueIndex = (playbackInfo.index + 1) % constants.audioData.length;

        if (enqueueIndex === 0 && !playbackSetting.loop) {
          break;
        }

        playbackInfo.nextStreamEnqueued = true;

        const enqueueToken = playbackInfo.playOrder[enqueueIndex];
        const playBehavior = 'ENQUEUE';
        const podcast = constants.audioData[playbackInfo.playOrder[enqueueIndex]];
        const expectedPreviousToken = playbackInfo.token;
        const offsetInMilliseconds = 0;

        responseBuilder.addAudioPlayerPlayDirective(
            playBehavior,
            podcast.url,
            enqueueToken,
            offsetInMilliseconds,
            expectedPreviousToken,
        );
        break;
      }
      case 'PlaybackFailed':
        playbackInfo.inPlaybackSession = false;
        console.log('Playback Failed : %j', handlerInput.requestEnvelope.request.error);
        return;
      default:
        throw new Error('Should never reach here!');
    }

    return responseBuilder.getResponse();
  },
};

const CheckAudioInterfaceHandler = {
  async canHandle(handlerInput) {
    const audioPlayerInterface = ((((handlerInput.requestEnvelope.context || {}).System || {}).device || {}).supportedInterfaces || {}).AudioPlayer;
    return audioPlayerInterface === undefined
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
        .speak('Sorry, dieser Skill wird auf Ihrem Gerät nicht unterstützt.')
        .withShouldEndSession(true)
        .getResponse();
  },
};

const StartPlaybackHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    if (!playbackInfo.inPlaybackSession) {
      return request.type === 'IntentRequest' && request.intent.name === 'PlayAudio';
    }
    if (request.type === 'PlaybackController.PlayCommandIssued') {
      return true;
    }

    if (request.type === 'IntentRequest') {
      return request.intent.name === 'PlayAudio' ||
          request.intent.name === 'AMAZON.ResumeIntent';
    }
  },
  handle(handlerInput) {
    return controller.play(handlerInput);
  },
};

const NextPlaybackHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    return playbackInfo.inPlaybackSession &&
        (request.type === 'PlaybackController.NextCommandIssued' ||
            (request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NextIntent'));
  },
  handle(handlerInput) {
    return controller.playNext(handlerInput);
  },
};

const PreviousPlaybackHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    return playbackInfo.inPlaybackSession &&
        (request.type === 'PlaybackController.PreviousCommandIssued' ||
            (request.type === 'IntentRequest' && request.intent.name === 'AMAZON.PreviousIntent'));
  },
  handle(handlerInput) {
    return controller.playPrevious(handlerInput);
  },
};

const PausePlaybackHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    return playbackInfo.inPlaybackSession &&
        request.type === 'IntentRequest' &&
        (request.intent.name === 'AMAZON.StopIntent' ||
            request.intent.name === 'AMAZON.CancelIntent' ||
            request.intent.name === 'AMAZON.PauseIntent');
  },
  handle(handlerInput) {
    return controller.stop(handlerInput);
  },
};

/*Helper function*/
async function getPlaybackInfo(handlerInput) {
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();
  return attributes.playbackInfo;
}

const controller = {
  async playPodcast(handlerInput) {
    const {
      attributesManager,
      responseBuilder
    } = handlerInput;

    const playbackInfo = await getPlaybackInfo(handlerInput);
    const {
      playOrder,
      offsetInMilliseconds,
      index
    } = playbackInfo;

    const playBehavior = 'REPLACE_ALL';
    const podcast = constants.audioData[playOrder[index]];
    const token = playOrder[index];
    playbackInfo.nextStreamEnqueued = false;

    responseBuilder
        .speak(`This is ${podcast.title}`)
        .withShouldEndSession(true)
        .addAudioPlayerPlayDirective(playBehavior, podcast.url, token, offsetInMilliseconds, null);

    if (await canThrowCard(handlerInput)) {
      const cardTitle = `Playing ${podcast.title}`;
      const cardContent = `Playing ${podcast.title}`;
      responseBuilder.withSimpleCard(cardTitle, cardContent);
    }

    return responseBuilder.getResponse();
  },
  stop(handlerInput) {
    return handlerInput.responseBuilder
        .addAudioPlayerStopDirective()
        .getResponse();
  },
  async playNext(handlerInput) {
    const {
      playbackInfo,
      playbackSetting,
    } = await handlerInput.attributesManager.getPersistentAttributes();

    const nextIndex = (playbackInfo.index + 1) % constants.audioData.length;

    if (nextIndex === 0 && !playbackSetting.loop) {
      return handlerInput.responseBuilder
          .speak('You have reached the end of the playlist')
          .addAudioPlayerStopDirective()
          .getResponse();
    }

    playbackInfo.index = nextIndex;
    playbackInfo.offsetInMilliseconds = 0;
    playbackInfo.playbackIndexChanged = true;

    return this.play(handlerInput);
  },
  async playPrevious(handlerInput) {
    const {
      playbackInfo,
      playbackSetting,
    } = await handlerInput.attributesManager.getPersistentAttributes();

    let previousIndex = playbackInfo.index - 1;

    if (previousIndex === -1) {
      if (playbackSetting.loop) {
        previousIndex += constants.audioData.length;
      } else {
        return handlerInput.responseBuilder
            .speak('You have reached the start of the playlist')
            .addAudioPlayerStopDirective()
            .getResponse();
      }
    }

    playbackInfo.index = previousIndex;
    playbackInfo.offsetInMilliseconds = 0;
    playbackInfo.playbackIndexChanged = true;

    return this.play(handlerInput);
  },
};

function getToken(handlerInput) {
  // Extracting token received in the request.
  return handlerInput.requestEnvelope.request.token;
}

async function getIndex(handlerInput) {
  // Extracting index from the token received in the request.
  const tokenValue = parseInt(handlerInput.requestEnvelope.request.token, 10);
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();

  return attributes.playbackInfo.playOrder.indexOf(tokenValue);
}

function getOffsetInMilliseconds(handlerInput) {
  // Extracting offsetInMilliseconds received in the request.
  return handlerInput.requestEnvelope.request.offsetInMilliseconds;
}

/* LAMBDA SETUP */
const skillBuilder = Alexa.SkillBuilders.standard();
exports.handler = skillBuilder
    .addRequestHandlers(
        CheckAudioInterfaceHandler,
        LaunchRequestHandler,
        SessionEndedRequestHandler,
        PlayRadioIntent,
        AudioPlayerEventHandler,
        ExitHandler,
        StartPlaybackHandler
    )
    .addRequestInterceptors(LocalizationInterceptor)
    .addErrorHandlers(ErrorHandler)
    .addRequestInterceptors(LoadPersistentAttributesRequestInterceptor)
    .addResponseInterceptors(SavePersistentAttributesResponseInterceptor)
    .withAutoCreateTable(true)
    .withTableName(constants.dynamoDBTableName)
    .lambda();